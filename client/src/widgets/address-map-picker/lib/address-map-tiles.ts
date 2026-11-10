/** Leaflet raster tiles (CARTO). SSR-safe — no `leaflet` import. */
const CARTO_LIGHT_TILE_BASE =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

function withCartoBasemapKey(url: string): string {
  const key = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY?.trim();
  if (!key) return url;
  return `${url}?key=${encodeURIComponent(key)}`;
}

/** Без `NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY` CARTO отдаёт watermark «API KEY REQUIRED». */
export const ADDRESS_MAP_TILE_URL = withCartoBasemapKey(CARTO_LIGHT_TILE_BASE);
