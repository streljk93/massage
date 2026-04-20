#!/usr/bin/env node
/**
 * Генерирует секреты для docker-compose в корневом `.env`:
 *   JWT_SECRET  — подпись JWT на бэкенде (Nest)
 *   AUTH_SECRET — Auth.js в контейнере client
 *
 *   npm run docker:env
 *   node scripts/generate-docker-env.mjs --force
 *
 * Потом: npm run docker:up   или   npm run docker:bootstrap
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const envPath = path.join(repoRoot, ".env");

const force = process.argv.includes("--force");

function randomSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * @param {string} text
 * @param {string} key
 * @param {string} value
 */
function upsert(text, key, value) {
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (re.test(text)) {
    if (!force) {
      return { text, didWrite: false };
    }
    return { text: text.replace(re, `${key}=${value}`), didWrite: true };
  }
  const line = `${key}=${value}\n`;
  if (!text || text.trim().length === 0) {
    return {
      text:
        "# docker-compose: JWT (Nest) + Auth.js (Next). Сгенерировано scripts/generate-docker-env.mjs\n" +
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
  /* новый файл */
}

const jwt = randomSecret();
const auth = randomSecret();

let skipped = [];

let r = upsert(text, "JWT_SECRET", jwt);
text = r.text;
if (!r.didWrite) skipped.push("JWT_SECRET");

r = upsert(text, "AUTH_SECRET", auth);
text = r.text;
if (!r.didWrite) skipped.push("AUTH_SECRET");

if (!text.endsWith("\n")) text += "\n";

fs.mkdirSync(path.dirname(envPath), { recursive: true });
fs.writeFileSync(envPath, text, "utf8");

console.log(`Записано: ${path.relative(repoRoot, envPath)}`);
if (skipped.length > 0) {
  console.log(
    `Пропущено (ключи уже есть): ${skipped.join(", ")} — добавьте --force чтобы заменить.`,
  );
} else {
  console.log("JWT_SECRET и AUTH_SECRET обновлены.");
}

process.exit(0);
