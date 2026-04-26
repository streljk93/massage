#!/usr/bin/env node
/**
 * MJML → HTML в `mail-templates/dist/*.html` для рантайма Nest (`MailTemplateService`).
 * Запуск: `npm run mail:templates` (также входит в `npm run build`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mjml2html from "mjml";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mjmlDir = path.join(root, "mail-templates", "mjml");
const outDir = path.join(root, "mail-templates", "dist");

function main() {
  if (!fs.existsSync(mjmlDir)) {
    console.error(`[mail:templates] Нет каталога ${mjmlDir}`);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(mjmlDir).filter((f) => f.endsWith(".mjml"));
  if (files.length === 0) {
    console.warn("[mail:templates] Нет .mjml файлов");
    return;
  }
  for (const file of files) {
    const base = path.basename(file, ".mjml");
    const srcPath = path.join(mjmlDir, file);
    const mjml = fs.readFileSync(srcPath, "utf8");
    const { html, errors } = mjml2html(mjml, {
      validationLevel: "soft",
    });
    if (errors?.length) {
      console.warn(`[mail:templates] ${file} warnings:`, errors);
    }
    const outPath = path.join(outDir, `${base}.html`);
    fs.writeFileSync(outPath, html, "utf8");
    console.log(`[mail:templates] ${file} → dist/${base}.html`);
  }
}

main();
