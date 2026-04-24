import { BadRequestException } from '@nestjs/common';

/** Согласовано с клиентом: `search-url-filters` (URL поиска). */
const RADIUS_M_MIN = 50;
const RADIUS_M_MAX = 500_000;

/**
 * Список каталога: `radiusM`, `radiusLat`, `radiusLng` (метры, WGS-84) — вместе или нет.
 * Иначе 400.
 */
export function parseDirectoryListRadiusFromQuery(
  radiusMRaw?: string,
  radiusLatRaw?: string,
  radiusLngRaw?: string,
): { radiusM: number; centerLat: number; centerLng: number } | null {
  const m =
    radiusMRaw === undefined || radiusMRaw === '' ? null : radiusMRaw.trim();
  const la =
    radiusLatRaw === undefined || radiusLatRaw === ''
      ? null
      : radiusLatRaw.trim();
  const ln =
    radiusLngRaw === undefined || radiusLngRaw === ''
      ? null
      : radiusLngRaw.trim();
  if (m == null && la == null && ln == null) {
    return null;
  }
  if (m == null || la == null || ln == null) {
    throw new BadRequestException({
      code: 'INVALID_RADIUS_PARAMS',
      message: 'radiusM, radiusLat and radiusLng must be provided together',
    });
  }
  const radiusM = Number.parseInt(m, 10);
  const centerLat = Number.parseFloat(la);
  const centerLng = Number.parseFloat(ln);
  if (
    !Number.isFinite(radiusM) ||
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng)
  ) {
    throw new BadRequestException({
      code: 'INVALID_RADIUS_PARAMS',
      message: 'radiusM, radiusLat and radiusLng must be valid numbers',
    });
  }
  if (radiusM < RADIUS_M_MIN || radiusM > RADIUS_M_MAX) {
    throw new BadRequestException({
      code: 'INVALID_RADIUS_PARAMS',
      message: 'radiusM is out of allowed range',
    });
  }
  if (
    centerLat < -90 ||
    centerLat > 90 ||
    centerLng < -180 ||
    centerLng > 180
  ) {
    throw new BadRequestException({
      code: 'INVALID_RADIUS_PARAMS',
      message: 'radiusLat or radiusLng is out of valid range',
    });
  }
  return { radiusM, centerLat, centerLng };
}
