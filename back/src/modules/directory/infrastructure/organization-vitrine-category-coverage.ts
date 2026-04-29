import { Prisma } from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';

const ORG_TEXT_SEARCH_LOCALES: ApiLocale[] = ['en', 'vi', 'ru'];

/** Подкатегория объявлена у салона и закрыта активным мастером из каталога с забронируемой услугой (VND). */
export function vitrineCategoryCoverageExists(): Prisma.Sql {
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "SpecialistOrganizationEmployment" e
      INNER JOIN "Specialist" sp ON sp.id = e."specialistId"
      INNER JOIN "Service" s ON s."specialistId" = e."specialistId"
        AND s."categoryId" = osc."serviceCategoryId"
        AND s."deletedAt" IS NULL
        AND s."isActive" = true
        AND (s."organizationId" IS NULL OR s."organizationId" = e."organizationId")
      INNER JOIN "ServicePriceOption" po ON po."serviceId" = s.id AND po."currency" = 'VND'
      WHERE e."organizationId" = osc."organizationId"
        AND e."isActive" = true
        AND sp."listedInDirectory" = true
        AND sp."deletedAt" IS NULL
        AND sp."activeOrganizationId" IS NOT NULL
        AND sp."activeOrganizationId" = e."organizationId"
    )
  `;
}

/**
 * Салоны, у которых есть мастер из каталога с **текущим** местом приёма = этому салону
 * (иначе запись через витрину организации невозможна).
 */
export async function queryOrganizationIdsInDirectoryWithCurrentWorkplaceSpecialists(
  prisma: { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> },
  restrictToOrganizationIds: string[] | null,
): Promise<string[]> {
  const restrict =
    restrictToOrganizationIds != null && restrictToOrganizationIds.length > 0
      ? Prisma.sql`AND o.id::text IN (${Prisma.join(restrictToOrganizationIds)})`
      : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT DISTINCT o.id::text AS id
      FROM "Organization" o
      WHERE o."deletedAt" IS NULL
      ${restrict}
      AND EXISTS (
        SELECT 1
        FROM "SpecialistOrganizationEmployment" e
        INNER JOIN "Specialist" sp ON sp.id = e."specialistId"
        WHERE e."organizationId" = o.id
          AND e."isActive" = true
          AND sp."listedInDirectory" = true
          AND sp."deletedAt" IS NULL
          AND sp."activeOrganizationId" IS NOT NULL
          AND sp."activeOrganizationId" = e."organizationId"
      )
    `,
  );
  return rows.map((r) => r.id);
}

/** Пары (organizationId, serviceCategoryId) только для «витринно» видимых OSC. */
export async function queryOrganizationStorefrontCategoryPairs(
  prisma: {
    $queryRaw: <T>(query: Prisma.Sql) => Promise<T>;
  },
  organizationIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (organizationIds.length === 0) {
    return out;
  }
  const rows = await prisma.$queryRaw<
    { organizationId: string; serviceCategoryId: string }[]
  >(
    Prisma.sql`
      SELECT osc."organizationId"::text AS "organizationId",
             osc."serviceCategoryId"::text AS "serviceCategoryId"
      FROM "OrganizationServiceCategory" osc
      INNER JOIN "ServiceCategory" sc ON sc.id = osc."serviceCategoryId"
      WHERE osc."organizationId"::text IN (${Prisma.join(organizationIds)})
        AND sc."deletedAt" IS NULL
        AND sc."isActive" = true
        AND ${vitrineCategoryCoverageExists()}
    `,
  );
  for (const r of rows) {
    let set = out.get(r.organizationId);
    if (set == null) {
      set = new Set<string>();
      out.set(r.organizationId, set);
    }
    set.add(r.serviceCategoryId);
  }
  return out;
}

export type OrganizationVitrineCategoryListFilter = {
  majorCategorySlug: string | null;
  categorySlugs: string[];
  /** Ограничить кандидатов (например, уже отфильтровано по радиусу). */
  restrictToOrganizationIds: string[] | null;
};

export async function queryOrganizationIdsMatchingVitrineCategoryConstraints(
  prisma: { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> },
  f: OrganizationVitrineCategoryListFilter,
): Promise<string[]> {
  const major =
    f.majorCategorySlug != null && f.majorCategorySlug.trim() !== ''
      ? f.majorCategorySlug.trim().toLowerCase()
      : null;
  const slugs = f.categorySlugs
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (major == null && slugs.length === 0) {
    return [];
  }

  const restrict =
    f.restrictToOrganizationIds != null &&
    f.restrictToOrganizationIds.length > 0
      ? Prisma.sql`AND o.id::text IN (${Prisma.join(f.restrictToOrganizationIds)})`
      : Prisma.empty;

  const majorClause =
    major != null
      ? Prisma.sql`AND LOWER(msc.slug) = ${major}
        AND msc."deletedAt" IS NULL
        AND msc."isActive" = true`
      : Prisma.sql`AND msc."deletedAt" IS NULL
        AND msc."isActive" = true`;

  const slugClause =
    slugs.length > 0
      ? Prisma.sql`AND LOWER(sc.slug) IN (${Prisma.join(slugs)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT DISTINCT o.id::text AS id
      FROM "Organization" o
      WHERE o."deletedAt" IS NULL
      ${restrict}
      AND EXISTS (
        SELECT 1
        FROM "OrganizationServiceCategory" osc
        INNER JOIN "ServiceCategory" sc ON sc.id = osc."serviceCategoryId"
        INNER JOIN "MajorServiceCategory" msc ON msc.id = sc."majorServiceCategoryId"
        WHERE osc."organizationId" = o.id
          AND sc."deletedAt" IS NULL
          AND sc."isActive" = true
          ${majorClause}
          ${slugClause}
          AND ${vitrineCategoryCoverageExists()}
      )
    `,
  );

  return rows.map((r) => r.id);
}

/**
 * Id организаций, у которых текст-поиск совпал с подкатегорией, видимой на витрине (OSC + покрытие).
 */
export async function queryOrganizationIdsMatchingStorefrontCategoryTextSearch(
  prisma: { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> },
  q: string,
  locale: ApiLocale,
  restrictToOrganizationIds: string[] | null,
): Promise<string[]> {
  const term = `%${q}%`;
  const locales = [...new Set([locale, ...ORG_TEXT_SEARCH_LOCALES])];

  const restrict =
    restrictToOrganizationIds != null && restrictToOrganizationIds.length > 0
      ? Prisma.sql`AND o.id::text IN (${Prisma.join(restrictToOrganizationIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT DISTINCT o.id::text AS id
      FROM "Organization" o
      WHERE o."deletedAt" IS NULL
      ${restrict}
      AND EXISTS (
        SELECT 1
        FROM "OrganizationServiceCategory" osc
        INNER JOIN "ServiceCategory" sc ON sc.id = osc."serviceCategoryId"
        WHERE osc."organizationId" = o.id
          AND sc."deletedAt" IS NULL
          AND sc."isActive" = true
          AND (
            sc.name ILIKE ${term}
            OR sc."shortName" ILIKE ${term}
            OR sc.slug ILIKE ${term}
            OR EXISTS (
              SELECT 1
              FROM "ServiceCategoryLocale" scl
              WHERE scl."serviceCategoryId" = sc.id
                AND scl.locale::text IN (${Prisma.join(locales)})
                AND (
                  scl.name ILIKE ${term}
                  OR scl."shortName" ILIKE ${term}
                )
            )
          )
          AND ${vitrineCategoryCoverageExists()}
      )
    `,
  );

  return rows.map((r) => r.id);
}

/** DISTINCT serviceCategoryId для фильтров каталога салонов — только с витринным покрытием. */
export async function queryDistinctStorefrontOrganizationServiceCategoryIds(prisma: {
  $queryRaw: <T>(query: Prisma.Sql) => Promise<T>;
}): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ serviceCategoryId: string }[]>(
    Prisma.sql`
      SELECT DISTINCT osc."serviceCategoryId"::text AS "serviceCategoryId"
      FROM "OrganizationServiceCategory" osc
      INNER JOIN "Organization" o ON o.id = osc."organizationId"
      INNER JOIN "ServiceCategory" sc ON sc.id = osc."serviceCategoryId"
      WHERE o."deletedAt" IS NULL
        AND sc."deletedAt" IS NULL
        AND sc."isActive" = true
        AND ${vitrineCategoryCoverageExists()}
        AND EXISTS (
          SELECT 1
          FROM "SpecialistOrganizationEmployment" e0
          INNER JOIN "Specialist" sp0 ON sp0.id = e0."specialistId"
          WHERE e0."organizationId" = o.id
            AND e0."isActive" = true
            AND sp0."listedInDirectory" = true
            AND sp0."deletedAt" IS NULL
            AND sp0."activeOrganizationId" IS NOT NULL
            AND sp0."activeOrganizationId" = e0."organizationId"
        )
    `,
  );
  return rows.map((r) => r.serviceCategoryId);
}
