/**
 * Проверяет pathname для редиректа после входа/регистрации: только внутренние
 * пути без локали (как в `next-intl` `router.push`), без open-redirect.
 */
export function safePostAuthPath(
  raw: string | null | undefined,
): string | null {
  if (raw == null) {
    return null;
  }
  const t = raw.trim();
  if (t === "" || !t.startsWith("/") || t.startsWith("//") || t.includes("://")) {
    return null;
  }
  if (t.includes("?") || t.includes("#")) {
    return null;
  }
  return t;
}
