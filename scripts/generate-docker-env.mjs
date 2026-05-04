#!/usr/bin/env node
/**
 * Обновляет общие секреты в корневом `.env` (монорепо + Docker Compose):
 *   JWT_SECRET  → сервис `back`
 *   AUTH_SECRET → сервис `client` (Auth.js)
 * Остальные ключи для compose (Postgres, Redis, MinIO, публичные URL) — см. корневой `.env.example`, допишите вручную или скопируйте шаблон.
 *
 *   npm run docker:env
 *   node scripts/generate-docker-env.mjs --force   — заменить даже непустые значения
 *
 * Если `.env` отсутствует, текст берётся из `.env.example`.
 * `ADMIN_MASTER_*` в `back/.env` задаёт только `npm run init` (конец `scripts/init-project.mjs`).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const examplePath = path.join(repoRoot, ".env.example");

const force = process.argv.includes("--force");

function randomSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

function readExampleSeed() {
  try {
    return fs.readFileSync(examplePath, "utf8");
  } catch {
    return "";
  }
}

function rhsLooksEmpty(raw) {
  const t = (raw ?? "").trim();
  if (t.length === 0) {
    return true;
  }
  if (t === '""' || t === "''") {
    return true;
  }
  return false;
}

/**
 * Пустой или отсутствующий RHS → подставляем значение.
 * Непустой RHS — не трогаем без --force.
 */
function upsertLine(text, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(`^\\s*${escaped}\\s*=.*$`, "m");
  const found = text.match(lineRe);

  if (found) {
    const line = found[0];
    const eq = line.indexOf("=");
    const rhs = eq >= 0 ? line.slice(eq + 1) : "";
    if (!rhsLooksEmpty(rhs) && !force) {
      return { text, didWrite: false };
    }
    return {
      text: text.replace(lineRe, `${key}=${value}`),
      didWrite: true,
    };
  }

  const line = `${key}=${value}\n`;
  if (!text.trim().length) {
    return {
      text:
        `# docker-compose — см. корневой .env.example. Сгенерировано scripts/generate-docker-env.mjs\n` +
        line,
      didWrite: true,
    };
  }
  return {
    text: `${text.replace(/\s*$/, "")}\n\n${line}`,
    didWrite: true,
  };
}

let text = "";
try {
  text = fs.readFileSync(envPath, "utf8");
} catch {
  text = "";
}

if (!text.trim().length) {
  const seed = readExampleSeed();
  text = seed.trim().length ? seed : "";
}

const jwt = randomSecret();
const auth = randomSecret();

const skipped = [];

let r = upsertLine(text, "JWT_SECRET", jwt);
text = r.text;
if (!r.didWrite) skipped.push("JWT_SECRET");

r = upsertLine(text, "AUTH_SECRET", auth);
text = r.text;
if (!r.didWrite) skipped.push("AUTH_SECRET");

if (!text.endsWith("\n")) text += "\n";

fs.mkdirSync(path.dirname(envPath), { recursive: true });
fs.writeFileSync(envPath, text, "utf8");

console.log(`Записано: ${path.relative(repoRoot, envPath)}`);
if (skipped.length > 0) {
  console.log(
    `Пропущено (уже заданы непустые значения): ${skipped.join(", ")} — --force для замены.`,
  );
} else {
  console.log("JWT_SECRET и AUTH_SECRET обновлены.");
}

process.exit(0);
