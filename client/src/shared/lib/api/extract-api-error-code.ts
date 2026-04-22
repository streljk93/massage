/** Код ошибки из тела ответа Nest (`code` или `message.code`). */
export function extractApiErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const o = error as Record<string, unknown>;
  if (typeof o.code === "string") {
    return o.code;
  }
  const msg = o.message;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    const inner = msg as Record<string, unknown>;
    if (typeof inner.code === "string") {
      return inner.code;
    }
  }
  return undefined;
}
