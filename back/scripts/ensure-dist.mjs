#!/usr/bin/env node
/**
 * Если `dist/src/main.js` нет (первый запуск / оборванная сборка), делаем `npm run build`,
 * иначе `nest start --watch` падает с MODULE_NOT_FOUND.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const backRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Совпадает с эмитом `tsc` (`rootDir: .`, `include: src/**`) и `nest start` → `dist/src/main.js`. */
const mainJs = path.join(backRoot, "dist", "src", "main.js");
if (existsSync(mainJs)) {
  process.exit(0);
}
const r = spawnSync("npm", ["run", "build"], {
  cwd: backRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
