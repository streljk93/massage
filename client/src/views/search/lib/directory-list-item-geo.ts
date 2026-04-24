import { distanceMeters } from "@/shared/lib/geo/distance-meters";

export function directoryListItemLatLng(geo: {
  latitude?: number | null;
  longitude?: number | null;
}): { lat: number; lng: number } | null {
  const lat = geo.latitude;
  const lng = geo.longitude;
  if (lat == null || lng == null) {
    return null;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat === 0 && lng === 0) {
    return null;
  }
  return { lat, lng: lng };
}

export function isDirectoryItemWithinRadiusMeters(
  geo: { latitude?: number | null; longitude?: number | null },
  centerLat: number,
  centerLng: number,
  radiusM: number,
): boolean {
  const p = directoryListItemLatLng(geo);
  if (p == null) {
    return false;
  }
  return (
    distanceMeters(p.lat, p.lng, centerLat, centerLng) <= radiusM
  );
}

const COORD_DEDUPE_PRECISION = 5;

/**
 * Оставляет одну карточку на уникальные координаты (тот же адрес, что и один пин на карте).
 * Используется вместе с фильтром по радиусу, когда несколько мастеров/салонов стоят в одной точке.
 */
export function dedupeDirectoryListItemsByLatLng<
  T extends { latitude?: number | null; longitude?: number | null },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const p = directoryListItemLatLng(item);
    if (p == null) continue;
    const key = `${p.lat.toFixed(COORD_DEDUPE_PRECISION)}_${p.lng.toFixed(COORD_DEDUPE_PRECISION)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
