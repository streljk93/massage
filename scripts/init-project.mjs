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
 *   --skip-ollama-pull не удалять локальный образ с предыдущим именем модели перед pull, не выполнять ollama pull (долго при первой загрузке)
 *
 * При полном прогоне поднимается стек из docker-compose (Postgres, MinIO, Ollama, image-moderation, Redis, MailHog, back, client),
 * ожидается готовность Postgres, MinIO, Ollama, Redis и веб-UI MailHog, при необходимости дописываются S3_*, SMTP_*, REDIS_* и OLLAMA_* в
 * `back/.env`; при необходимости синхронизируются или дописываются `ADMIN_MASTER_*` (**только в back/.env**); мигрируют устаревший `OLLAMA_BASE_URL=http://127.0.0.1:11434` → `:11435` (проброс в compose совпадает с `OLLAMA_DOCKER_PUBLISH_PORT` в этом скрипте);
 * если было имя модели без суффикса (типично `llama3`), замена на актуальный тег (сейчас «llama3.2», см. moderation-defaults);
 * при необходимости в контейнере удаляется старый образ перед загрузкой новой модели; затем migrate + seed + openapi:sync.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const args = new Set(process.argv.slice(2));
const skipDocker = args.has("--skip-docker");
const skipOpenapi = args.has("--skip-openapi");
const depsOnly = args.has("--deps-only");
const skipOllamaPull = args.has("--skip-ollama-pull");

/** См. back/src/config/moderation-defaults.const.ts — DEFAULT_OLLAMA_MODERATION_MODEL. */
const DEFAULT_OLLAMA_MODEL = "llama3.2";
/** Имя устаревшей модели в старых .env/local storage — перед pull удаляется `ollama rm` при init. */
const LEGACY_OLLAMA_MODEL = "llama3";
/** Порт на хосте для сервиса `ollama` в docker compose (проброс host:CONTAINER на 11434). Нативный Ollama на macOS занимает 11434 — не ставим второй процесс там. */
const OLLAMA_DOCKER_PUBLISH_PORT = "11435";

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

async function waitMailhogReady(timeoutMs = 120000) {
  const stepMs = 2000;
  const start = Date.now();
  log("Ожидание готовности MailHog (веб-интерфейс на :8025)…");
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch("http://127.0.0.1:8025/", {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        log(
          "MailHog готов (входящие: http://localhost:8025, SMTP для back: 127.0.0.1:1025).",
        );
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

async function waitOllamaReady(timeoutMs = 180000) {
  const stepMs = 2000;
  const start = Date.now();
  log(`Ожидание порта Ollama — HTTP для хоста :${OLLAMA_DOCKER_PUBLISH_PORT} (:11434 внутри образа), без загрузки модели…`);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(
        `http://127.0.0.1:${OLLAMA_DOCKER_PUBLISH_PORT}/`,
        {
          signal: AbortSignal.timeout(4000),
        },
      );
      if (res.ok || res.status === 404) {
        log("Ollama отвечает; далее init при необходимости выполнит `ollama pull`.");
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

async function waitImageModerationReady(timeoutMs = 120000) {
  const stepMs = 2000;
  const start = Date.now();
  log("Ожидание сервиса модерации картинок (HTTP :8085, /healthz)…");
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch("http://127.0.0.1:8085/healthz", {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j && j.status === "ok") {
          log(
            "image-moderation готов (NSFW-сервис: POST /v1/score; см. docker/nsfw-image-moderation).",
          );
          return true;
        }
      }
    } catch {
      /* образ ещё собирается / контейнер стартует */
    }
    process.stdout.write(".");
    await wait(stepMs);
  }
  console.log("");
  return false;
}

async function waitRedisReady(timeoutMs = 60000) {
  const stepMs = 2000;
  const start = Date.now();
  log("Ожидание готовности Redis (BullMQ, redis-cli ping)…");
  while (Date.now() - start < timeoutMs) {
    const r = spawnSync(
      "docker",
      ["compose", "exec", "-T", "redis", "redis-cli", "ping"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const out = (r.stdout ?? "").trim().toUpperCase();
    if (r.status === 0 && out === "PONG") {
      log("Redis принимает команды (:6379).");
      return true;
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

/** Redis для BullMQ (очередь фоновой модерации профиля салона). При `back` только в Docker — хост `redis`. */
function ensureBackEnvRedisLocal() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    /* нет файла */
  }
  if (/(?:^|\n)\s*REDIS_HOST\s*=/.test(text)) {
    return;
  }
  const block =
    "\n# init-project — Redis из docker compose (сервис redis, BullMQ / модерация профиля организации)\n" +
    "REDIS_HOST=127.0.0.1\n" +
    "REDIS_PORT=6379\n" +
    "MODERATION_QUEUE_ENABLED=true\n";
  const prefix = text.length && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(p, `${text}${prefix}${block}`, "utf8");
  log(
    "Добавлены REDIS_* и MODERATION_QUEUE_ENABLED в back/.env (localhost:6379).",
  );
}

function ensureBackEnvOllamaLocal() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    /* нет файла */
  }
  if (/(?:^|\n)\s*OLLAMA_BASE_URL\s*=/.test(text)) {
    return;
  }
  const block =
    "\n# init-project — Ollama из docker compose (предмодерация текста; с хоста порт см. docker-compose.yml)\n" +
    `OLLAMA_BASE_URL=http://127.0.0.1:${OLLAMA_DOCKER_PUBLISH_PORT}\n` +
    `OLLAMA_MODEL=${DEFAULT_OLLAMA_MODEL}\n`;
  const prefix = text.length && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(p, `${text}${prefix}${block}`, "utf8");
  log(
    `Добавлены OLLAMA_* в back/.env для API на localhost:${OLLAMA_DOCKER_PUBLISH_PORT}.`,
  );
}

/**
 * Сервер предмодерации фото (docker-compose: image-moderation).
 * Nest на хосте: контейнер скачивает файлы через host.docker.internal (Docker Desktop).
 * При Linux без host.docker.internal смените на http://172.17.0.1:3001 или см. доку compose.
 */
function ensureBackEnvImageModerationLocal() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    /* нет файла */
  }
  if (/(?:^|\n)\s*IMAGE_MODERATION_BASE_URL\s*=/.test(text)) {
    return;
  }
  const block =
    "\n# init-project — модерация фото через docker compose (сервис image-moderation, порт :8085)\n" +
    "IMAGE_MODERATION_BASE_URL=http://127.0.0.1:8085\n" +
    "# откуда Python-контейнер тянет GET /v1/files/… (Nest на хосте; Linux: при необходимости 172.17.0.1:PORT)\n" +
    "MODERATION_FILE_FETCH_ORIGIN=http://host.docker.internal:3001\n";
  const prefix = text.length && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(p, `${text}${prefix}${block}`, "utf8");
  log(
    "Добавлены IMAGE_MODERATION_BASE_URL (+ MODERATION_FILE_FETCH_ORIGIN) в back/.env для локального контейнера image-moderation.",
  );
}

function ensureBackEnvMailhogLocal() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    /* нет файла */
  }
  if (/(?:^|\n)\s*SMTP_HOST\s*=/.test(text)) {
    return;
  }
  const block =
    "\n# init-project — MailHog (docker compose: сервис mailhog). В dev back шлёт OTP только по SMTP, не Resend\n" +
    "SMTP_HOST=127.0.0.1\n" +
    "SMTP_PORT=1025\n" +
    "SMTP_SECURE=false\n" +
    "MAIL_FROM=\"Dev <dev@local.test>\"\n";
  const prefix = text.length && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(p, `${text}${prefix}${block}`, "utf8");
  log(
    "Добавлены SMTP_* / MAIL_FROM в back/.env (письма с localhost back → MailHog :8025).",
  );
}

/**
 * Раньше init писал OLLAMA на :11434; нативный Ollama на Mac занимает тот же порт. Docker теперь публикует :11435→:11434.
 */
function migrateBackEnvDockerOllamaPublishPort() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    return;
  }
  let changed = false;
  const lines = text.split(/\r?\n/);
  const next = lines.map((line) => {
    const m = /^(\s*OLLAMA_BASE_URL\s*=\s*)(\S+)/.exec(line);
    if (!m) return line;
    const url = m[2].trim();
    if (
      /^https?:\/\/(127\.0\.0\.1|localhost):11434\/?$/i.test(url)
    ) {
      changed = true;
      return `${m[1]}http://127.0.0.1:${OLLAMA_DOCKER_PUBLISH_PORT}`;
    }
    return line;
  });
  if (!changed) return;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(p, next.join(eol), "utf8");
  log(
    `Обновлено «OLLAMA_BASE_URL» на порт контейнерного Ollama на хосте :${OLLAMA_DOCKER_PUBLISH_PORT} (:11434 внутри образа — см. docker-compose.yml).`,
  );
}

/**
 * Если в back/.env указано именно значение «llama3» (старое имя модели в Ollama),
 * замена на актуальный тег (совпадает с `DEFAULT_OLLAMA_MODEL` / `moderation-defaults.const.ts`, сейчас «llama3.2»).
 */
function migrateBackEnvLegacyOllamaModel() {
  const p = path.join(repoRoot, "back", ".env");
  let text = "";
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    return;
  }
  let changed = false;
  /** Значение — первое «слово» после `=` (без кавычек не обрабатываем «"llama3"». */
  const re = /^([ \t]*OLLAMA_MODEL[ \t]*=[ \t]*)(\S+)/;
  const lines = text.split(/\r?\n/);
  const next = lines.map((line) => {
    const m = re.exec(line);
    if (!m) return line;
    if (m[2] !== LEGACY_OLLAMA_MODEL) return line;
    changed = true;
    return `${m[1]}${DEFAULT_OLLAMA_MODEL}${line.slice(m[0].length)}`;
  });
  if (!changed) return;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(p, next.join(eol), "utf8");
  log(
    `Обновлено «OLLAMA_MODEL» в back/.env: ${LEGACY_OLLAMA_MODEL} → ${DEFAULT_OLLAMA_MODEL}.`,
  );
}

/**
 * Удаляет локальный образ устаревшей модели в контейнере `ollama` (освобождает место).
 * Если образа не было — ошибка игнорируется.
 */
function removeLegacyOllamaModelFromCompose() {
  if (skipOllamaPull) {
    return;
  }
  log(
    `Удаление устаревшей модели «${LEGACY_OLLAMA_MODEL}» в контейнере ollama (если была локально; не мешает ${DEFAULT_OLLAMA_MODEL})…`,
  );
  const r = spawnSync(
    "docker",
    ["compose", "exec", "-T", "ollama", "ollama", "rm", LEGACY_OLLAMA_MODEL],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (r.status !== 0) {
    console.warn(
      `[init] Удалить «${LEGACY_OLLAMA_MODEL}» не удалось или модели уже нет — это не критично перед загрузкой ${DEFAULT_OLLAMA_MODEL}.`,
    );
  } else {
    log(`Образ модели «${LEGACY_OLLAMA_MODEL}» удалён из Ollama.`);
  }
}

/**
 * Подтягивает модель в контейнер `ollama` (долго при первой загрузке).
 * Имя модели: env `OLLAMA_MODEL` или см. константу `DEFAULT_OLLAMA_MODEL` в этом файле.
 */
function pullOllamaModelIntoCompose() {
  if (skipOllamaPull) {
    log(
      "Пропуск удаления legacy-модели и `ollama pull` (--skip-ollama-pull).",
    );
    return;
  }
  const model = (process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL).trim();
  log(`Загрузка модели Ollama в контейнер: ollama pull ${model} (может занять много времени)…`);
  const r = spawnSync(
    "docker",
    ["compose", "exec", "-T", "ollama", "ollama", "pull", model],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (r.status !== 0) {
    console.warn(
      `\n[init] ollama pull ${model} завершился с ошибкой (код ${r.status}). Позже: docker compose exec ollama ollama pull ${model}`,
    );
  } else {
    log(`Модель «${model}» в Ollama готова.`);
  }
}

const ADMIN_MASTER_KEYS = [
  "ADMIN_MASTER_NAME",
  "ADMIN_MASTER_EMAIL",
  "ADMIN_MASTER_PASSWORD",
];

function adminMasterRhsNonempty(raw) {
  const t = (raw ?? "").trim();
  if (t.length === 0) return false;
  if (t === '""' || t === "''") return false;
  return true;
}

function adminMasterParseAssignments(text) {
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2] ?? "";
  }
  return out;
}

function adminMasterHasKeyLine(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*=`).test(text);
}

function adminMasterStripEnvKeys(text, keys) {
  const keySet = new Set(keys);
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const outLines = [];
  for (const line of lines) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && keySet.has(m[1])) continue;
    outLines.push(line);
  }
  const joined = outLines.join(eol === "\r\n" ? "\r\n" : "\n");
  return joined.replace(/(\r?\n){3,}/g, `${eol}${eol}`);
}

/**
 * `ADMIN_MASTER_*` только в `back/.env`: миграция из корня, дописывание недостающих ключей.
 */
function ensureAdminMasterInBackDotEnv() {
  const rootPath = path.join(repoRoot, ".env");
  const backPath = path.join(repoRoot, "back", ".env");

  let rootText = "";
  try {
    rootText = fs.readFileSync(rootPath, "utf8");
  } catch {
    /* нет файла */
  }
  let backText = "";
  try {
    backText = fs.readFileSync(backPath, "utf8");
  } catch {
    /* нет файла */
  }

  const rootMap = adminMasterParseAssignments(rootText);

  const migratedLines = [];
  for (const key of ADMIN_MASTER_KEYS) {
    if (adminMasterHasKeyLine(backText, key)) continue;
    if (!adminMasterRhsNonempty(rootMap[key])) continue;
    migratedLines.push(`${key}=${rootMap[key].trim()}`);
  }
  if (migratedLines.length > 0) {
    const pre = backText.length && !backText.endsWith("\n") ? "\n" : "";
    backText = `${backText}${pre}${migratedLines.join("\n")}\n`;
    console.log(
      `[init/env] ADMIN_MASTER_* перенесены из корня в ${path.relative(repoRoot, backPath)}.`,
    );
  }

  const hadAdminInRootBefore = ADMIN_MASTER_KEYS.some((k) =>
    adminMasterHasKeyLine(rootText, k),
  );
  if (hadAdminInRootBefore) {
    let nextRoot = adminMasterStripEnvKeys(rootText, ADMIN_MASTER_KEYS);
    nextRoot = nextRoot.replace(
      /^\s*#\s*Суперадмин:?[^\r\n]*(?:\r?\n|$)/gim,
      "",
    );
    nextRoot = nextRoot.replace(/\s+$/, "");
    const withNl = nextRoot.length === 0 ? "" : `${nextRoot}\n`;
    fs.mkdirSync(path.dirname(rootPath), { recursive: true });
    fs.writeFileSync(rootPath, withNl, "utf8");
    console.log(
      "[init/env] Ключи ADMIN_MASTER_* удалены из корневого .env (источник — back/.env).",
    );
  }

  const toGenerate = [];
  if (!adminMasterHasKeyLine(backText, "ADMIN_MASTER_NAME")) {
    toGenerate.push("ADMIN_MASTER_NAME=Platform Admin");
  }
  if (!adminMasterHasKeyLine(backText, "ADMIN_MASTER_EMAIL")) {
    toGenerate.push(
      `ADMIN_MASTER_EMAIL=admin.${randomBytes(8).toString("hex")}@local.dev`,
    );
  }
  if (!adminMasterHasKeyLine(backText, "ADMIN_MASTER_PASSWORD")) {
    toGenerate.push(
      `ADMIN_MASTER_PASSWORD=${randomBytes(21).toString("base64url")}`,
    );
  }

  if (toGenerate.length > 0) {
    const header =
      "\n# Суперадмин: при старте Nest создаёт/обновляет пользователя master (ADMIN_MASTER_EMAIL + пароль).\n";
    const block = `${header}${toGenerate.join("\n")}\n`;
    const prefix = backText.length && !backText.endsWith("\n") ? "\n" : "";
    backText = `${backText}${prefix}${block}`;
    console.log(
      `[init/env] В ${path.relative(repoRoot, backPath)} дописаны недостающие ADMIN_MASTER_*.`,
    );
  }

  const backNeedsWrite =
    migratedLines.length > 0 || toGenerate.length > 0;
  if (backNeedsWrite) {
    fs.mkdirSync(path.dirname(backPath), { recursive: true });
    const outBack =
      backText.endsWith("\n") || backText.length === 0 ? backText : `${backText}\n`;
    fs.writeFileSync(backPath, outBack, "utf8");
  }
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
  ensureAdminMasterInBackDotEnv();

  if (skipDocker) {
    log("Пропуск Docker (--skip-docker).");
    migrateBackEnvDockerOllamaPublishPort();
    migrateBackEnvLegacyOllamaModel();
    if (!skipOpenapi && process.env.DATABASE_URL) {
      run("openapi:sync", "npm", ["run", "openapi:sync"], repoRoot);
    } else if (!skipOpenapi) {
      log(
        "OpenAPI: пропуск (нет DATABASE_URL в окружении; задайте и выполните npm run openapi:sync).",
      );
    }
    log(
      "Далее: docker compose up -d (postgres + redis + minio + ollama + image-moderation + mailhog + …), см. docker-compose.yml; MinIO :9000, Redis :6379, MailHog :8025, Ollama через хост :" +
        OLLAMA_DOCKER_PUBLISH_PORT +
        ", NSFW-картинки :8085.",
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

  if (!(await waitRedisReady())) {
    console.error(
      "\n[init] Таймаут ожидания Redis. Проверьте: docker compose ps, docker compose logs redis",
    );
    process.exit(1);
  }

  if (!(await waitMinioReady())) {
    console.error(
      "\n[init] Таймаут ожидания MinIO. Проверьте: docker compose ps, docker compose logs minio",
    );
    process.exit(1);
  }

  if (!(await waitMailhogReady())) {
    console.error(
      "\n[init] Таймаут ожидания MailHog. Проверьте: docker compose ps, docker compose logs mailhog (в compose должен быть сервис mailhog, см. docker-compose.yml)",
    );
    process.exit(1);
  }

  if (!(await waitOllamaReady())) {
    console.error(
      "\n[init] Таймаут ожидания Ollama. Проверьте: docker compose ps, docker compose logs ollama",
    );
    process.exit(1);
  }

  if (!(await waitImageModerationReady())) {
    console.error(
      "\n[init] Таймаут ожидания image-moderation (:8085). Проверьте: docker compose ps, docker compose logs image-moderation, или docker compose up -d --build image-moderation",
    );
    process.exit(1);
  }

  migrateBackEnvDockerOllamaPublishPort();

  ensureBackEnvMinioLocal();
  ensureBackEnvMailhogLocal();
  ensureBackEnvOllamaLocal();
  ensureBackEnvImageModerationLocal();
  ensureBackEnvRedisLocal();

  migrateBackEnvLegacyOllamaModel();
  removeLegacyOllamaModelFromCompose();
  pullOllamaModelIntoCompose();

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
  • Redis (BullMQ):  localhost:6379 (фон модерации; init дописывает REDIS_* в back/.env, если нет REDIS_HOST)
  • Ollama (хост для docker): http://localhost:${OLLAMA_DOCKER_PUBLISH_PORT} • init: миграция back/.env, rm старого тега, pull ${DEFAULT_OLLAMA_MODEL}; иначе npm run init -- --skip-ollama-pull
  • Модерация фото:  http://localhost:8085/healthz • POST /v1/score (docker: image-moderation; при необходимости MODERATION_FILE_FETCH_ORIGIN в back/.env)
  • MailHog:         http://localhost:8025 (входящие письма; OTP при регистрации при SMTP в back/.env, см. init)
  • Файлы (MinIO): POST /v1/files/public | POST /v1/files/private (Bearer); GET /v1/files/public/:filename | GET /v1/files/private/:filename (Bearer)

  Локальный фронт без Docker: cd client && npm run dev
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
