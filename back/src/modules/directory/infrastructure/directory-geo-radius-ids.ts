import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/** WGS-84, как `distanceMeters` на клиенте. */
const R_EARTH_M = 6_371_000;

/**
 * id организаций с координатами, попадающими в круг (центр + радиус, метры).
 * `(0,0)` исключаем — договорённость с `directoryListItemLatLng` на клиенте.
 */
export async function findOrganizationIdsWithinRadiusMeters(
  prisma: PrismaService,
  centerLat: number,
  centerLng: number,
  radiusM: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT o."id"::text AS "id"
    FROM "Organization" o
    WHERE o."deletedAt" IS NULL
      AND o."latitude" IS NOT NULL
      AND o."longitude" IS NOT NULL
      AND NOT (o."latitude" = 0 AND o."longitude" = 0)
      AND (
        ${R_EARTH_M}::double precision * acos(
          LEAST(1.0::double precision, GREATEST(-1.0::double precision,
            cos(radians(${centerLat}::double precision))
            * cos(radians(o."latitude"::double precision))
            * cos(
              radians(o."longitude"::double precision) - radians(${centerLng}::double precision)
            )
            + sin(radians(${centerLat}::double precision))
            * sin(radians(o."latitude"::double precision))
          ))
        )
      ) <= ${radiusM}::double precision
  `;
  return rows.map((r) => r.id);
}

/**
 * id специалистов, у кого `activeOrganization` в круге (гео с салона, как в API списка).
 */
export async function findSpecialistIdsWithinRadiusMeters(
  prisma: PrismaService,
  centerLat: number,
  centerLng: number,
  radiusM: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s."id"::text AS "id"
    FROM "Specialist" s
    INNER JOIN "Organization" o ON o."id" = s."activeOrganizationId"
    WHERE s."deletedAt" IS NULL
      AND s."listedInDirectory" = true
      AND o."deletedAt" IS NULL
      AND o."latitude" IS NOT NULL
      AND o."longitude" IS NOT NULL
      AND NOT (o."latitude" = 0 AND o."longitude" = 0)
      AND (
        ${R_EARTH_M}::double precision * acos(
          LEAST(1.0::double precision, GREATEST(-1.0::double precision,
            cos(radians(${centerLat}::double precision))
            * cos(radians(o."latitude"::double precision))
            * cos(
              radians(o."longitude"::double precision) - radians(${centerLng}::double precision)
            )
            + sin(radians(${centerLat}::double precision))
            * sin(radians(o."latitude"::double precision))
          ))
        )
      ) <= ${radiusM}::double precision
  `;
  return rows.map((r) => r.id);
}
