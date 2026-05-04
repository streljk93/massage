#!/usr/bin/env sh
# Одноразовый pg_dump в ./backups/postgres/ (gzip).
# Использование (из корня репозитория):
#   sh scripts/pg-backup-once.sh [docker-compose.yml|docker-compose.prod.yml]
# Пример cron (ежедневно в 03:15):
#   15 3 * * * cd /path/to/repo && sh scripts/pg-backup-once.sh docker-compose.prod.yml
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${1:-docker-compose.yml}"
cd "$ROOT"
mkdir -p backups/postgres
OUT="$ROOT/backups/postgres/dump_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -c >"$OUT"
echo "OK: $OUT"
