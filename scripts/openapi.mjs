#!/usr/bin/env node
/**
 * OpenAPI: экспорт спеки с бэкенда и генерация TS-типов на клиенте.
 *
 * Запуск из корня монорепо:
 *   npm run openapi:export  — только back/openapi/openapi.json
 *   npm run openapi:types   — только client (нужен актуальный openapi.json)
 *   npm run openapi:sync    — export + types (полная синхронизация)
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const backDir = join(repoRoot, "back");
const clientDir = join(repoRoot, "client");

function runExport() {
  console.log("[openapi] back → openapi/openapi.json");
  execSync("npm run openapi:export", {
    cwd: backDir,
    stdio: "inherit",
    env: process.env,
  });
}

function runTypes() {
  console.log("[openapi] client → src/shared/api/generated/openapi.d.ts");
  execSync("npm run api:types", {
    cwd: clientDir,
    stdio: "inherit",
    env: process.env,
  });
}

const cmd = process.argv[2] ?? "sync";

try {
  if (cmd === "export") {
    runExport();
  } else if (cmd === "types") {
    runTypes();
  } else if (cmd === "sync") {
    runExport();
    runTypes();
  } else {
    console.error(
      "Usage: node scripts/openapi.mjs [export|types|sync]\n" +
        "  export — только генерация openapi.json в back\n" +
        "  types  — только openapi-typescript в client\n" +
        "  sync   — оба шага (по умолчанию)",
    );
    process.exit(1);
  }
} catch (e) {
  process.exit(e?.status ?? 1);
}
