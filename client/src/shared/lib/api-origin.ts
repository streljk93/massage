/**
 * Origin Nest API без суффикса `/v1`.
 * Dev: `http://localhost:3001`, если не заданы `NEXT_PUBLIC_API_URL` / `AUTH_BACKEND_URL`.
 */
export function resolveApiOrigin(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.AUTH_BACKEND_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }
  return undefined;
}

/** База typed SDK: `{origin}/v1` или same-origin `/v1` (Next rewrite в dev). */
export function resolveApiV1BaseUrl(): string {
  const origin = resolveApiOrigin();
  if (origin) {
    return `${origin}/v1`;
  }
  return "/v1";
}
