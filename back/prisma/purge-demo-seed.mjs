/**
 * Однократная очистка демо-салонов и demo.*@example.com из БД.
 * Запуск из `back/`: `npm run prisma:purge-demo` (нужен DATABASE_URL).
 */
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { purgeDemoSeedData } from './seed-demo-specialists.mjs';

const seedFileDir = dirname(fileURLToPath(import.meta.url));
const backDir = resolve(seedFileDir, '..');
const repoRoot = resolve(backDir, '..');

for (const p of [
  resolve(repoRoot, '.env'),
  resolve(repoRoot, '.env.local'),
  resolve(backDir, '.env'),
  resolve(backDir, '.env.local'),
]) {
  loadEnv({ path: p, override: true });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for purge-demo-seed');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

purgeDemoSeedData(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
