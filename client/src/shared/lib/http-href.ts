/** Ссылка https для значения сайта из API (со схемой или без). */
export function httpsHrefFromWebsiteStored(
  raw: string | null | undefined,
): string | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
