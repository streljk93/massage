# NSFW image scoring + CLIP harm (CPU). Крупные загрузки: torch/OpenCLIP (~ build time).
FROM python:3.11-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# Torch CPU-колёса затем остальной стек (open_clip_torch тянет torch при необходимости).
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Прогрев: NudeNet + OpenCLIP один раз при сборке (долго, но первый запрос клиента быстрее)
RUN python -c "from nudenet import NudeDetector; NudeDetector()" \
 && python -c "import open_clip; open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k'); open_clip.get_tokenizer('ViT-B-32')"

ENV PORT=8085
EXPOSE 8085

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
