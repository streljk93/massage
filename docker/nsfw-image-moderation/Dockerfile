# NSFW image scoring (CPU). Скачивание весов при первом импорте nudenet (~сотни MB сети при build).
FROM python:3.11-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Прогрев: скачать веса один раз на этапе сборки
RUN python -c "from nudenet import NudeDetector; NudeDetector()"

ENV PORT=8085
EXPOSE 8085

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
