#!/bin/sh
set -e

if find prisma/migrations -name "*.sql" 2>/dev/null | head -1 | grep -q .; then
  echo "Applying Prisma migrations..."
  npx prisma migrate deploy
else
  echo "No SQL migrations in prisma/migrations; skipping migrate deploy."
fi

echo "Seeding default catalog (idempotent)..."
npx prisma db seed

exec node dist/src/main.js
