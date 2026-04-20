#!/usr/bin/env node
/**
 * Генерирует AUTH_SECRET для Auth.js (добавьте в client/.env.local).
 * Запуск: node scripts/generate-auth-secret.mjs
 *         node scripts/generate-auth-secret.mjs --write-client  — дописать в client/.env.local, если секрета ещё нет
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const clientEnvLocal = path.join(repoRoot, "client", ".env.local");

const secret = crypto.randomBytes(32).toString("base64");

function hasAuthSecretBlock(text) {
  return /(?:^|\n)\s*AUTH_SECRET\s*=/.test(text) || /(?:^|\n)\s*NEXTAUTH_SECRET\s*=/.test(text);
}

const args = process.argv.slice(2);
const writeClient = args.includes("--write-client");

console.log("");
console.log("Добавьте в client/.env.local строку (или скопируйте блок ниже):");
console.log("");
console.log(`AUTH_SECRET=${secret}`);
console.log("");

if (writeClient) {
  let existing = "";
  try {
    existing = fs.readFileSync(clientEnvLocal, "utf8");
  } catch {
    /* file missing */
  }
  if (hasAuthSecretBlock(existing)) {
    console.log("Пропуск записи: в client/.env.local уже есть AUTH_SECRET или NEXTAUTH_SECRET.");
    process.exit(0);
  }
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  const block = `${prefix}# Auth.js — сгенерировано scripts/generate-auth-secret.mjs\nAUTH_SECRET=${secret}\n`;
  fs.mkdirSync(path.dirname(clientEnvLocal), { recursive: true });
  fs.appendFileSync(clientEnvLocal, block, "utf8");
  console.log(`Записано в ${path.relative(repoRoot, clientEnvLocal)}`);
}

process.exit(0);
