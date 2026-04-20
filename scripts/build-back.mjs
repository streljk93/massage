#!/usr/bin/env node
/**
 * Сборка Nest (back): prisma generate + nest build.
 * npm run build:back
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backRoot = path.join(__dirname, "..", "back");

const r = spawnSync("npm", ["run", "build"], {
  cwd: backRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(r.status ?? 1);
