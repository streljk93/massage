/**
 * UUID v4 через `crypto.randomUUID`, если доступно (в т.ч. только в secure context).
 * На `http://<ip>:…` без HTTPS многие браузеры не дают `randomUUID` — тогда строковый fallback.
 */
export function randomUuid(): string {
  const c = globalThis.crypto;
  if (c != null && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
