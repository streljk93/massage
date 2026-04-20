#!/usr/bin/env node
/**
 * Preflight client → build client → build back.
 * npm run build:all
 * npm run build:all -- --skip-preflight
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const scriptsDir = __dirname;

const skipPreflight = process.argv.includes("--skip-preflight");

const clientArgs = [path.join(scriptsDir, "build-client.mjs")];
if (skipPreflight) {
  clientArgs.push("--skip-preflight");
}

let r = spawnSync(process.execPath, clientArgs, {
  cwd: repoRoot,
  stdio: "inherit",
});
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

r = spawnSync(process.execPath, [path.join(scriptsDir, "build-back.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
});
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

console.log("build:all OK");
process.exit(0);
