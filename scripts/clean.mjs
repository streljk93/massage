#!/usr/bin/env node
/**
 * Удаляет артефакты сборки.
 * Запуск: node scripts/clean.mjs           — client/.next
 *         node scripts/clean.mjs --back     — и back/dist (если есть)
 *         node scripts/clean.mjs --all      — оба
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

function rmDirIfExists(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("removed", path.relative(repoRoot, p));
  } catch (e) {
    console.error("skip", p, e.message);
  }
}

const args = new Set(process.argv.slice(2));
const all = args.has("--all");
const back = all || args.has("--back");
const clientOnly = !back && !all;

if (clientOnly || all) {
  rmDirIfExists(path.join(repoRoot, "client", ".next"));
}

if (back || all) {
  rmDirIfExists(path.join(repoRoot, "back", "dist"));
}

process.exit(0);
