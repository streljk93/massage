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
    INNER JOIN "Address" a ON a."id" = o."addressId"
    WHERE o."deletedAt" IS NULL
      AND a."latitude" IS NOT NULL
      AND a."longitude" IS NOT NULL
      AND NOT (a."latitude" = 0 AND a."longitude" = 0)
      AND (
        ${R_EARTH_M}::double precision * acos(
          LEAST(1.0::double precision, GREATEST(-1.0::double precision,
            cos(radians(${centerLat}::double precision))
            * cos(radians(a."latitude"::double precision))
            * cos(
              radians(a."longitude"::double precision) - radians(${centerLng}::double precision)
            )
            + sin(radians(${centerLat}::double precision))
            * sin(radians(a."latitude"::double precision))
          ))
        )
      ) <= ${radiusM}::double precision
  `;
  return rows.map((r) => r.id);
}

/**
 * id специалистов, у кого активное место приёма в круге (гео с организации, как в API списка).
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
    INNER JOIN "SpecialistWorkplace" w
      ON w."specialistId" = s."id"
      AND w."isActive" = true
      AND w."deletedAt" IS NULL
    INNER JOIN "Organization" o ON o."id" = w."organizationId"
    INNER JOIN "Address" a ON a."id" = o."addressId"
    WHERE s."deletedAt" IS NULL
      AND s."listedInDirectory" = true
      AND o."deletedAt" IS NULL
      AND a."latitude" IS NOT NULL
      AND a."longitude" IS NOT NULL
      AND NOT (a."latitude" = 0 AND a."longitude" = 0)
      AND (
        ${R_EARTH_M}::double precision * acos(
          LEAST(1.0::double precision, GREATEST(-1.0::double precision,
            cos(radians(${centerLat}::double precision))
            * cos(radians(a."latitude"::double precision))
            * cos(
              radians(a."longitude"::double precision) - radians(${centerLng}::double precision)
            )
            + sin(radians(${centerLat}::double precision))
            * sin(radians(a."latitude"::double precision))
          ))
        )
      ) <= ${radiusM}::double precision
  `;
  return rows.map((r) => r.id);
}
