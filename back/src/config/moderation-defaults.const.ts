/**
 * Дефолтная модель Ollama для предмодерации (см. `ollama pull` / compose / `DEFAULT_OLLAMA_MODEL` в init).
 * Держите в синхроне: `docker-compose.yml` (OLLAMA_MODEL), `docker/ollama-compose-entrypoint.sh`,
 * `scripts/init-project.mjs` (DEFAULT_OLLAMA_MODEL).
 */
export const DEFAULT_OLLAMA_MODERATION_MODEL = 'llama3.2' as const;
