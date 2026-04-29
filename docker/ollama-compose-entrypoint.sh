#!/bin/sh
# Контейнер Ollama: после старта daemon подтягивает модель (дефолт см. back/src/config/moderation-defaults.const.ts).
set -eu
MODEL="${OLLAMA_MODEL:-llama3.2}"

command -v ollama >/dev/null 2>&1 || {
  echo "ollama not found in PATH" >&2
  exit 1
}

echo "[ollama entrypoint] starting ollama serve…"
ollama serve &
SERV_PID="$!"

i=0
while [ "$i" -lt 120 ]; do
  if ollama list >/dev/null 2>&1; then
    echo "[ollama entrypoint] server ready"
    break
  fi
  i=$((i + 1))
  sleep 1
done

if ! ollama list >/dev/null 2>&1; then
  echo "[ollama entrypoint] timed out waiting for server" >&2
  kill "$SERV_PID" 2>/dev/null || true
  exit 1
fi

echo "[ollama entrypoint] pulling model: ${MODEL}"
ollama pull "${MODEL}" || echo "[ollama entrypoint] WARNING: ollama pull failed (network / disk); retry later with: docker compose exec ollama ollama pull ${MODEL}" >&2

echo "[ollama entrypoint] waiting on ollama serve (pid ${SERV_PID})…"
wait "$SERV_PID"
