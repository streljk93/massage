// Как у Nest `envFilePath`: корень репозитория → `back/`; последний файл побеждает.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(backDir, "..");

for (const p of [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, ".env.local"),
  resolve(backDir, ".env"),
  resolve(backDir, ".env.local"),
]) {
  loadEnv({ path: p, override: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
