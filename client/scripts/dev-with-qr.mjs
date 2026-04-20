#!/usr/bin/env node
/**
 * Поднимает `next dev` на 0.0.0.0 и печатает QR с URL в LAN (удобно открыть с телефона).
 * Запуск: npm run dev:qr [-- -p 3001 ...]
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const qrcode = require("qrcode-terminal");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.join(__dirname, "..");
const nextCli = path.join(clientRoot, "node_modules", "next", "dist", "bin", "next");

function getPort(argv) {
  const pShort = argv.indexOf("-p");
  if (pShort !== -1 && argv[pShort + 1]) return argv[pShort + 1];
  const pLongEq = argv.find((a) => a.startsWith("--port="));
  if (pLongEq) return pLongEq.split("=")[1];
  const pLong = argv.indexOf("--port");
  if (pLong !== -1 && argv[pLong + 1]) return argv[pLong + 1];
  if (process.env.PORT) return process.env.PORT;
  return "3000";
}

function getLanIps() {
  /** @type {string[]} */
  const ips = [];
  const nets = os.networkInterfaces();
  for (const key of Object.keys(nets)) {
    for (const net of nets[key] ?? []) {
      if (net && net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return [...new Set(ips)];
}

const forwardedArgs = process.argv.slice(2);
const port = getPort(forwardedArgs);
const ips = getLanIps();
/** Совпадает с `defaultLocale` в `src/app/i18n/routing.ts` */
const pathPrefix = "/en";

if (ips.length === 0) {
  console.warn(
    "[dev:qr] Не найден IPv4 LAN-интерфейс — QR пропущен. Проверь Wi‑Fi / провод.\n",
  );
} else {
  const primary = ips[0];
  const url = `http://${primary}:${port}${pathPrefix}`;
  console.log("\n────────── Телефон (та же сеть Wi‑Fi) ──────────");
  qrcode.generate(url, { small: true });
  console.log(`\n  ${url}`);
  if (ips.length > 1) {
    console.log(
      "  Другие интерфейсы:",
      ips
        .slice(1)
        .map((ip) => `http://${ip}:${port}${pathPrefix}`)
        .join(" · "),
    );
  }
  console.log("────────────────────────────────────────────────\n");
}

const child = spawn(
  process.execPath,
  [nextCli, "dev", "-H", "0.0.0.0", ...forwardedArgs],
  {
    stdio: "inherit",
    cwd: clientRoot,
    env: { ...process.env, PORT: port },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
