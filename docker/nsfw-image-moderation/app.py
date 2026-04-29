"""
HTTP-сервис: оценка изображений по URL (скачивание + NudeNet detector v3, ONNX).

Не CLIP-текста: unsafe_score — max(confidence) по зонам тела из NudeNet (GENITAL/BUTTOCK/BREAST/… см. `_label_implicitly_nsfw`).
Картинки без таких регионов (логотип, мульт, «неприличная» символика без тел) дают unsafe_score≈0 — ограничение модели;
для них остаётся ручная модерация или отдельный CLIP/VLM. При необходимости замените сервис, сохранив JSON `/v1/score`.
"""

from __future__ import annotations

import os
import tempfile
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from nudenet import NudeDetector

MAX_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(12 * 1024 * 1024)))
FETCH_TIMEOUT_SEC = float(os.environ.get("FETCH_TIMEOUT_SEC", "45"))

_detector: NudeDetector | None = None


def get_detector() -> NudeDetector:
    global _detector
    if _detector is None:
        _detector = NudeDetector()
    return _detector


def _label_implicitly_nsfw(label: str) -> bool:
    """
    NudeNet v3 (~18 классов): GENITALIA/BUTTOCKS/BREAST (exposed & covered), и т.д.
    Раньше искали только «BREAST_EXPOSED» — класс `FEMALE_BREAST_COVERED` не матчился;
    `BUTTOCKS_*` тоже выпадали. Берём явные зоны тела; лица/стопы не считаем NSFW.
    """
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


app = FastAPI(title="services-app image moderation", version="1.0.0")


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
        # Частый случай: 127.0.0.1 внутри Docker — нужен host.docker.internal / имя сервиса compose
        raise HTTPException(
            status_code=502,
            detail=f"upstream_image_fetch_failed: {exc!s}",
        ) from exc

    ctype = rsp.headers.get("content-type", "").lower()

    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image too large")

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
    os.close(fd)
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
    safe_label = unsafe <= 0.5
    return {
        "safe": safe_label,
        "unsafe_score": unsafe,
        "safe_score": safe_score,
        "bytes": len(data),
        "detections_truncated_count": len(detections),
    }
