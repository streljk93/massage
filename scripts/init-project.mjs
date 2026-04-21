#!/usr/bin/env node
/**
 * Первичная инициализация монорепо: зависимости, секреты, Docker, OpenAPI-типы.
 *
 * Запуск из корня репозитория:
 *   npm run init
 *
 * Флаги:
 *   --skip-docker     не поднимать docker compose
 *   --skip-openapi    не вызывать openapi:sync
 *   --deps-only       только npm install в back и client
 *
 * При полном прогоне поднимается стек из docker-compose (Postgres, MinIO, back, client),
 * ожидается готовность Postgres и MinIO, затем migrate + seed + openapi:sync.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const args = new Set(process.argv.slice(2));
const skipDocker = args.has("--skip-docker");
const skipOpenapi = args.has("--skip-openapi");
const depsOnly = args.has("--deps-only");

function log(msg) {
  console.log(`\n[init] ${msg}`);
}

function run(label, cmd, cmdArgs, cwd = repoRoot, env = process.env) {
  log(`${label}: ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  if (r.status !== 0) {
    console.error(`\n[init] Ошибка (${label}), код выхода ${r.status ?? "?"}`);
    process.exit(r.status ?? 1);
  }
}

function npmInstall(pkgDir) {
  const name = path.basename(pkgDir);
  log(`Зависимости: ${name}`);
  const r = spawnSync("npm", ["install"], {
    cwd: pkgDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`\n[init] npm install не удался в ${name}`);
    process.exit(r.status ?? 1);
  }
}

function hasDockerCompose() {
  const r = spawnSync("docker", ["compose", "version"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return r.status === 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitPostgresReady(timeoutMs = 120000) {
  const stepMs = 2000;
  const start = Date.now();
  log("Ожидание готовности PostgreSQL (docker compose)…");
  while (Date.now() - start < timeoutMs) {
    const r = spawnSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "services",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (r.status === 0) {
      log("PostgreSQL принимает подключения.");
      return true;
    }
    process.stdout.write(".");
    await wait(stepMs);
  }
  console.log("");
  return false;
}

async function waitMinioReady(timeoutMs = 120000) {
  const stepMs = 2000;
  const start = Date.now();
  log("Ожидание готовности MinIO (S3 API на :9000)…");
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch("http://127.0.0.1:9000/minio/health/live", {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        log("MinIO готов (консоль: http://localhost:9001, логин minioadmin / minioadmin).");
        return true;
      }
    } catch {
      /* контейнер ещё стартует */
    }
    process.stdout.write(".");
    await wait(stepMs);
  }
  console.log("");
  return false;
}

function ensureBackEnvMinioLocal() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    /* нет файла */
  }
  if (/(?:^|\n)\s*S3_ENDPOINT\s*=/.test(text)) {
    return;
  }
  const block =
    "\n# init-project — MinIO из docker compose (сервис minio)\n" +
    "S3_ENDPOINT=http://127.0.0.1:9000\n" +
    "S3_ACCESS_KEY=minioadmin\n" +
    "S3_SECRET_KEY=minioadmin\n" +
    "S3_BUCKET=services-uploads\n" +
    "S3_REGION=us-east-1\n";
  const prefix = text.length && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(p, `${text}${prefix}${block}`, "utf8");
  log("Добавлены S3_* в back/.env для загрузки файлов через localhost:9000.");
}

function ensureClientEnvBackendUrl() {
  const p = path.join(repoRoot, "client", ".env.local");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    /* нет файла */
  }
  if (/(?:^|\n)\s*AUTH_BACKEND_URL\s*=/.test(text)) {
    return;
  }
  const line =
    "# init-project — бэкенд на localhost для dev вне Docker\nAUTH_BACKEND_URL=http://localhost:3001\n";
  const prefix = text.length && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(p, `${text}${prefix}${line}`, "utf8");
  log("Добавлен AUTH_BACKEND_URL в client/.env.local (для npm run dev на хосте).");
}

async function main() {
  console.log("[init] Инициализация services-app (корень: %s)", repoRoot);

  npmInstall(path.join(repoRoot, "back"));
  npmInstall(path.join(repoRoot, "client"));

  if (depsOnly) {
    log("Готово (--deps-only).");
    process.exit(0);
  }

  run(
    "generate-docker-env",
    process.execPath,
    [path.join(repoRoot, "scripts", "generate-docker-env.mjs")],
  );
  run("auth:secret:write", "npm", ["run", "auth:secret:write"], repoRoot);
  ensureClientEnvBackendUrl();

  if (skipDocker) {
    log("Пропуск Docker (--skip-docker).");
    if (!skipOpenapi && process.env.DATABASE_URL) {
      run("openapi:sync", "npm", ["run", "openapi:sync"], repoRoot);
    } else if (!skipOpenapi) {
      log(
        "OpenAPI: пропуск (нет DATABASE_URL в окружении; задайте и выполните npm run openapi:sync).",
      );
    }
    log(
      "Далее: docker compose up -d (postgres + minio + …), см. docker-compose.yml; для файлов — MinIO :9000.",
    );
    process.exit(0);
  }

  if (!hasDockerCompose()) {
    console.error(
      "\n[init] Нет `docker compose`. Установите Docker или запустите с --skip-docker.",
    );
    process.exit(1);
  }

  run("docker:up", "docker", ["compose", "up", "--build", "-d"], repoRoot);

  if (!(await waitPostgresReady())) {
    console.error(
      "\n[init] Таймаут ожидания PostgreSQL. Проверьте: docker compose ps, docker compose logs postgres",
    );
    process.exit(1);
  }

  if (!(await waitMinioReady())) {
    console.error(
      "\n[init] Таймаут ожидания MinIO. Проверьте: docker compose ps, docker compose logs minio",
    );
    process.exit(1);
  }

  ensureBackEnvMinioLocal();

  await wait(5000);

  const dbUrl =
    "postgresql://postgres:postgres@127.0.0.1:5432/services?schema=public";
  run(
    "prisma migrate deploy",
    "npm",
    ["run", "prisma:deploy"],
    path.join(repoRoot, "back"),
    { ...process.env, DATABASE_URL: dbUrl },
  );
  run(
    "prisma db seed",
    "npm",
    ["run", "prisma:seed"],
    path.join(repoRoot, "back"),
    { ...process.env, DATABASE_URL: dbUrl },
  );

  if (!skipOpenapi) {
    log("openapi:sync…");
    const r = spawnSync("npm", ["run", "openapi:sync"], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    if (r.status !== 0) {
      console.warn(
        "\n[init] openapi:sync завершился с ошибкой — позже: npm run openapi:sync",
      );
    }
  } else {
    log("Пропуск openapi:sync (--skip-openapi).");
  }

  console.log(`
[init] Готово.

  • Фронт (Docker):  http://localhost:3000
  • API (Docker):    http://localhost:3001
  • Swagger:         http://localhost:3001/v1/docs
  • Postgres:        localhost:5432 (см. docker-compose)
  • MinIO (S3):      http://localhost:9000  • консоль http://localhost:9001 (minioadmin / minioadmin)
  • Файлы (MinIO): POST /v1/files/public | POST /v1/files/private (Bearer); GET /v1/files/public/:filename | GET /v1/files/private/:filename (Bearer)

  Локальный фронт без Docker: cd client && npm run dev
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
