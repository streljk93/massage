/**
 * Город из «плоского» `address` (Nominatim, LocationIQ lookup и т.п.).
 */
export function pickCityFromOsmStyleAddress(
  a: Record<string, string> | null | undefined,
): string | null {
  if (!a) {
    return null;
  }
  const v =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.city_district ||
    a.suburb ||
    a.hamlet;
  if (v && v.trim()) {
    return v.trim().slice(0, 120);
  }
  return null;
}
