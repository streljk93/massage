"""
HTTP-сервис: оценка изображений по URL.

1. NudeNet — телесный NSFW (unsafe_score по зонам тела).
2. CLIP OpenCLIP ViT-B-32 — для каждой категории (violence, blood …) softmax между
   промптом вреда и общим нейтральным промптом; порог REVIEW см. MODERATION_CLIP_*.
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import Any

import httpx
import torch
from fastapi import FastAPI, HTTPException
from nudenet import NudeDetector
from PIL import Image
from pydantic import BaseModel, Field
from urllib.parse import urlparse

CLIP_ENABLED_ENV = os.environ.get("IMAGE_MODERATION_CLIP_ENABLED", "true").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

CLIP_REVIEW_THRESHOLD = float(os.environ.get("MODERATION_CLIP_REVIEW_THRESHOLD", "0.7"))

CLIP_PROMPTS: dict[str, str] = {
    "violence": "photograph of graphic violence brutal fight or assault injuries",
    "blood": "photograph showing blood bleeding or open wounds",
    "gore": "photograph of gore severe injury or mutilation",
    "injury": "photograph of serious physical injury trauma bruising or wounds",
    "weapon": (
        "photograph prominently showing weapons firearm knife blade in threatening context"
    ),
}

CLIP_NEUTRAL_PROMPT = (
    "photograph suitable for salon business listing peaceful portrait interior benign "
    "no graphic violence no blood no gore"
)

MAX_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(12 * 1024 * 1024)))
FETCH_TIMEOUT_SEC = float(os.environ.get("FETCH_TIMEOUT_SEC", "45"))

_detector: NudeDetector | None = None
_clip_model: torch.nn.Module | None = None
_clip_preprocess = None  # torchvision transform
_clip_tokenizer: Any = None


def get_detector() -> NudeDetector:
    global _detector
    if _detector is None:
        _detector = NudeDetector()
    return _detector


def get_clip_bundle() -> tuple[torch.nn.Module, Any, Any]:
    """Lazy-load OpenCLIP (ViT-B-32 LAION); CPU inference."""
    global _clip_model, _clip_preprocess, _clip_tokenizer
    if _clip_model is None:
        import open_clip

        pretrained = os.environ.get("OPEN_CLIP_PRETRAINED", "laion2b_s34b_b79k").strip()
        model, _, preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32",
            pretrained=pretrained,
        )
        _clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")
        device = torch.device("cpu")
        model = model.eval().to(device)
        _clip_model = model
        _clip_preprocess = preprocess
    return _clip_model, _clip_preprocess, _clip_tokenizer


def _clip_scores_for_tensor(pil_image: Image.Image) -> tuple[dict[str, float], bool]:
    """
    По каждой категории: softmax между logit(image·harm_emb) vs logit(image·neutral_emb).
    Ревью: violence > T OR blood > T или любое другое из пяти > T (как пользовательское ТЗ).
    """
    model, preprocess, tokenizer = get_clip_bundle()
    device = next(model.parameters()).device

    img_t = preprocess(pil_image.convert("RGB")).unsqueeze(0).to(device)
    keys_order = tuple(CLIP_PROMPTS.keys())

    with torch.no_grad():
        image_feats = model.encode_image(img_t)
        image_feats = image_feats / image_feats.norm(dim=-1, keepdim=True)
        nt = tokenizer([CLIP_NEUTRAL_PROMPT]).to(device)
        neutral_emb = model.encode_text(nt)
        neutral_emb = neutral_emb / neutral_emb.norm(dim=-1, keepdim=True)
        ls = model.logit_scale.exp()
        neutral_logit = (ls * (image_feats @ neutral_emb.T))[0, 0]

        scores_out: dict[str, float] = {}
        for hk in keys_order:
            ht = tokenizer([CLIP_PROMPTS[hk]]).to(device)
            harm_emb = model.encode_text(ht)
            harm_emb = harm_emb / harm_emb.norm(dim=-1, keepdim=True)
            harm_logit = (ls * (image_feats @ harm_emb.T))[0, 0]
            pair_logits = torch.stack([harm_logit, neutral_logit])
            p_harm = float(pair_logits.softmax(0)[0].item())
            scores_out[hk] = p_harm

        harm_max = max(scores_out[k] for k in keys_order)
        scores_out["harm_max"] = harm_max

        clip_review = any(
            scores_out[k] > CLIP_REVIEW_THRESHOLD for k in keys_order
        )

        return scores_out, clip_review


def _label_implicitly_nsfw(label: str) -> bool:
    u = label.upper().replace("-", "_").replace(" ", "_")
    if u.startswith("FACE_") or "FEET_" in u or "FOOT_" in u:
        return False
    needles = (
        "GENITAL",
        "GLANS",
        "PENIS",
        "VAGINA",
        "ANUS",
        "PERINEUM",
        "INTERGLUTEAL",
        "BUTTOCK",
        "BREAST",
        "AREOLA",
        "NIPPLE",
        "BELLY_",
        "ARMPITS",
    )
    return any(n in u for n in needles)


def detector_to_unsafe_score(detections: list[dict[str, Any]]) -> float:
    best = 0.0
    for item in detections:
        lab = str(
            item.get("label") or item.get("class") or item.get("name") or "",
        )
        try:
            sc = float(item.get("score") or item.get("confidence") or 0)
        except (TypeError, ValueError):
            continue
        if _label_implicitly_nsfw(lab):
            best = max(best, sc)
    return min(1.0, max(0.0, best))


class ScoreRequest(BaseModel):
    image_url: str = Field(
        ...,
        description="Абсолютный HTTP(S) URL картинки, доступный этому контейнеру",
    )


def _validate_http_url(raw: str) -> str:
    url = raw.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail="image_url must be absolute http(s) URL reachable from this service",
        )
    return url


app = FastAPI(title="services-app image moderation", version="2.0.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/score")
def score(body: ScoreRequest) -> dict[str, Any]:
    url = _validate_http_url(body.image_url)

    try:
        with httpx.Client(timeout=FETCH_TIMEOUT_SEC, follow_redirects=True) as client:
            rsp = client.get(url)
            rsp.raise_for_status()
            data = rsp.content
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"upstream_image_fetch_failed: {exc!s}",
        ) from exc

    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image too large")

    ctype = rsp.headers.get("content-type", "").lower()

    suffix = ".bin"
    if "jpeg" in ctype or "jpg" in ctype:
        suffix = ".jpg"
    elif "png" in ctype:
        suffix = ".png"
    elif "webp" in ctype:
        suffix = ".webp"
    elif "gif" in ctype:
        suffix = ".gif"

    fd, tmppath = tempfile.mkstemp(suffix=suffix)
    detections: list[dict[str, Any]] | None = None
    try:
        with open(tmppath, "wb") as f:
            f.write(data)
        detections = get_detector().detect(tmppath)
    finally:
        try:
            os.unlink(tmppath)
        except OSError:
            pass

    if detections is None:
        detections = []
    unsafe = detector_to_unsafe_score(detections)
    safe_score = 1.0 - unsafe
    safe_label_legacy = unsafe <= 0.5

    pil_image = Image.open(io.BytesIO(data))

    clip_block: dict[str, Any]
    clip_flagged = False

    if CLIP_ENABLED_ENV:
        try:
            clip_probs, clip_flagged = _clip_scores_for_tensor(pil_image)
            clip_block = {
                "enabled": True,
                "threshold": CLIP_REVIEW_THRESHOLD,
                "scores": clip_probs,
                "review_recommended": clip_flagged,
            }
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500,
                detail=f"clip_scoring_failed: {exc!s}",
            ) from exc
    else:
        clip_block = {"enabled": False}

    return {
        "safe": safe_label_legacy,
        "unsafe_score": unsafe,
        "safe_score": safe_score,
        "bytes": len(data),
        "detections_truncated_count": len(detections),
        "clip": clip_block,
    }
