#!/usr/bin/env node
/**
 * Проверки перед production build фронта: eslint + tsc.
 * Запуск из корня репо: npm run preflight:client
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.join(__dirname, "..", "client");

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: clientRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

run("npm", ["run", "lint"]);
run("npx", ["tsc", "--noEmit"]);
console.log("preflight:client OK");
process.exit(0);
