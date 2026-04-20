#!/usr/bin/env node
/**
 * Сборка Next.js (client). Опционально без preflight.
 * npm run build:client
 * npm run build:client -- --skip-preflight
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const clientRoot = path.join(repoRoot, "client");
const scriptsDir = __dirname;

const skipPreflight = process.argv.includes("--skip-preflight");

if (!skipPreflight) {
  const p = spawnSync(process.execPath, [path.join(scriptsDir, "preflight-client.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (p.status !== 0) process.exit(p.status ?? 1);
}

const r = spawnSync("npm", ["run", "build"], {
  cwd: clientRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(r.status ?? 1);
