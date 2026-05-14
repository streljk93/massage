import { Prisma } from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';

const ORG_TEXT_SEARCH_LOCALES: ApiLocale[] = ['en', 'vi', 'ru'];

/** Условие на `Specialist` sp: витринный профиль мастера одобрен или есть гостевой снимок (опубликованная ревизия / строка). */
const specialistVitrineProfileSql = Prisma.sql`(
  sp."profilePublicationModerationStatus" = 'approved'::"PublicationModerationStatus"
  OR (
    sp."profilePublicationModerationStatus" IN (
      'pending_review'::"PublicationModerationStatus",
      'rejected'::"PublicationModerationStatus"
    )
    AND (
      sp."publishedProfileRevisionId" IS NOT NULL
      OR length(trim(COALESCE(sp."listingName", ''))) > 0
      OR length(trim(COALESCE(sp."bio", ''))) > 0
      OR (sp."imageUrl" IS NOT NULL AND length(trim(COALESCE(sp."imageUrl", ''))) > 0)
    )
  )
)`;

const specialistVitrineProfileSqlSp0 = Prisma.sql`(
  sp0."profilePublicationModerationStatus" = 'approved'::"PublicationModerationStatus"
  OR (
    sp0."profilePublicationModerationStatus" IN (
      'pending_review'::"PublicationModerationStatus",
      'rejected'::"PublicationModerationStatus"
    )
    AND (
      sp0."publishedProfileRevisionId" IS NOT NULL
      OR length(trim(COALESCE(sp0."listingName", ''))) > 0
      OR length(trim(COALESCE(sp0."bio", ''))) > 0
      OR (sp0."imageUrl" IS NOT NULL AND length(trim(COALESCE(sp0."imageUrl", ''))) > 0)
    )
  )
)`;

/** Имя мастера во витрине: одобренное на строке или из опубликованной ревизии (или строка до первой публикации). */
const specialistVitrineListingNameSql = Prisma.sql`(
  (
    sp."profilePublicationModerationStatus" = 'approved'::"PublicationModerationStatus"
    AND sp."listingName" IS NOT NULL
    AND length(trim(COALESCE(sp."listingName", ''))) > 0
  )
  OR (
    sp."profilePublicationModerationStatus" IN (
      'pending_review'::"PublicationModerationStatus",
      'rejected'::"PublicationModerationStatus"
    )
    AND (
      EXISTS (
        SELECT 1
        FROM "SpecialistProfileRevision" spr
        WHERE spr.id = sp."publishedProfileRevisionId"
          AND spr.status = 'published'::"SpecialistProfileRevisionStatus"
          AND length(trim(COALESCE(spr."listingName", ''))) > 0
      )
      OR (
        sp."publishedProfileRevisionId" IS NULL
        AND sp."listingName" IS NOT NULL
        AND length(trim(COALESCE(sp."listingName", ''))) > 0
      )
    )
  )
)`;

const specialistVitrineListingNameSqlSp0 = Prisma.sql`(
  (
    sp0."profilePublicationModerationStatus" = 'approved'::"PublicationModerationStatus"
    AND sp0."listingName" IS NOT NULL
    AND length(trim(COALESCE(sp0."listingName", ''))) > 0
  )
  OR (
    sp0."profilePublicationModerationStatus" IN (
      'pending_review'::"PublicationModerationStatus",
      'rejected'::"PublicationModerationStatus"
    )
    AND (
      EXISTS (
        SELECT 1
        FROM "SpecialistProfileRevision" spr0
        WHERE spr0.id = sp0."publishedProfileRevisionId"
          AND spr0.status = 'published'::"SpecialistProfileRevisionStatus"
          AND length(trim(COALESCE(spr0."listingName", ''))) > 0
      )
      OR (
        sp0."publishedProfileRevisionId" IS NULL
        AND sp0."listingName" IS NOT NULL
        AND length(trim(COALESCE(sp0."listingName", ''))) > 0
      )
    )
  )
)`;

/** Подкатегория в OSC закрыта активным мастером с назначением на опубликованный оффер точки и активной ценой VND. */
export function vitrineCategoryCoverageExists(): Prisma.Sql {
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "SpecialistOrganizationEmployment" e
      INNER JOIN "Specialist" sp ON sp.id = e."specialistId"
        AND ${specialistVitrineProfileSql}
        AND ${specialistVitrineListingNameSql}
      INNER JOIN "SpecialistOffering" so ON so."specialistId" = e."specialistId"
        AND so."deletedAt" IS NULL
        AND so."status" = 'active'::"SpecialistOfferingStatus"
      INNER JOIN "OrganizationOffering" oo ON oo.id = so."organizationOfferingId"
        AND oo."organizationId" = e."organizationId"
        AND oo."categoryId" = osc."serviceCategoryId"
        AND oo."deletedAt" IS NULL
        AND oo."publicationStatus" = 'published'::"OfferingPublicationStatus"
      INNER JOIN "OfferingPriceOption" po ON po."organizationOfferingId" = oo.id
        AND po."currency" = 'VND'
        AND po."deletedAt" IS NULL
        AND po."status" = 'active'::"OfferingPriceOptionStatus"
      WHERE e."organizationId" = osc."organizationId"
        AND e."isActive" = true
        AND sp."listedInDirectory" = true
        AND sp."deletedAt" IS NULL
        AND EXISTS (
          SELECT 1
          FROM "SpecialistWorkplace" w
          WHERE w."specialistId" = sp.id
            AND w."organizationId" = e."organizationId"
            AND w."isActive" = true
            AND w."deletedAt" IS NULL
        )
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
        AND o."publicationModerationStatus" = 'approved'::"PublicationModerationStatus"
      ${restrict}
      AND EXISTS (
        SELECT 1
        FROM "SpecialistOrganizationEmployment" e
        INNER JOIN "Specialist" sp ON sp.id = e."specialistId"
          AND ${specialistVitrineProfileSql}
          AND ${specialistVitrineListingNameSql}
        WHERE e."organizationId" = o.id
          AND e."isActive" = true
          AND sp."listedInDirectory" = true
          AND sp."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1
            FROM "SpecialistWorkplace" w
            WHERE w."specialistId" = sp.id
              AND w."organizationId" = e."organizationId"
              AND w."isActive" = true
              AND w."deletedAt" IS NULL
          )
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

export type SpecialistVitrineCategoryListFilter = {
  majorCategorySlug: string | null;
  categorySlugs: string[];
  /** Уже ограниченные id мастера (например радиус). */
  restrictToSpecialistIds: string[] | null;
};

/**
 * Мастера с тегами SSC по подкатегории, где для **текущего** активного салона есть витринная OSC с покрытием.
 * Без голого SSC «вне салона» — синхрон с карточкой организации по OSC.
 */
export async function querySpecialistIdsMatchingStorefrontCategoryConstraints(
  prisma: { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> },
  f: SpecialistVitrineCategoryListFilter,
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
    f.restrictToSpecialistIds != null && f.restrictToSpecialistIds.length > 0
      ? Prisma.sql`AND sp.id::text IN (${Prisma.join(f.restrictToSpecialistIds)})`
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
      SELECT DISTINCT sp.id::text AS id
      FROM "Specialist" sp
      INNER JOIN "SpecialistSkill" ssc ON ssc."specialistId" = sp.id
      INNER JOIN "ServiceCategory" sc ON sc.id = ssc."serviceCategoryId"
      INNER JOIN "MajorServiceCategory" msc ON msc.id = sc."majorServiceCategoryId"
      INNER JOIN "SpecialistWorkplace" w
        ON w."specialistId" = sp.id
        AND w."isActive" = true
        AND w."deletedAt" IS NULL
      INNER JOIN "OrganizationServiceCategory" osc
        ON osc."organizationId" = w."organizationId"
        AND osc."serviceCategoryId" = sc.id
      WHERE sp."deletedAt" IS NULL
        AND sp."listedInDirectory" = true
        AND sc."deletedAt" IS NULL
        AND sc."isActive" = true
        ${majorClause}
        ${slugClause}
        ${restrict}
        AND ${vitrineCategoryCoverageExists()}
    `,
  );

  return rows.map((r) => r.id);
}

/**
 * Текст по подкатегории — только SSC, закреплённые за витринной OSC активного салона мастера.
 */
export async function querySpecialistIdsMatchingStorefrontCategoryTextSearch(
  prisma: { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> },
  q: string,
  locale: ApiLocale,
  restrictToSpecialistIds: string[] | null,
): Promise<string[]> {
  const term = `%${q}%`;
  const locales = [...new Set([locale, ...ORG_TEXT_SEARCH_LOCALES])];

  const restrict =
    restrictToSpecialistIds != null && restrictToSpecialistIds.length > 0
      ? Prisma.sql`AND sp.id::text IN (${Prisma.join(restrictToSpecialistIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT DISTINCT sp.id::text AS id
      FROM "Specialist" sp
      INNER JOIN "SpecialistSkill" ssc ON ssc."specialistId" = sp.id
      INNER JOIN "ServiceCategory" sc ON sc.id = ssc."serviceCategoryId"
      INNER JOIN "SpecialistWorkplace" w
        ON w."specialistId" = sp.id
        AND w."isActive" = true
        AND w."deletedAt" IS NULL
      INNER JOIN "OrganizationServiceCategory" osc
        ON osc."organizationId" = w."organizationId"
        AND osc."serviceCategoryId" = sc.id
      WHERE sp."deletedAt" IS NULL
        AND sp."listedInDirectory" = true
        AND sc."deletedAt" IS NULL
        AND sc."isActive" = true
        ${restrict}
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
            AND ${specialistVitrineProfileSqlSp0}
            AND ${specialistVitrineListingNameSqlSp0}
          WHERE e0."organizationId" = o.id
            AND e0."isActive" = true
            AND sp0."listedInDirectory" = true
            AND sp0."deletedAt" IS NULL
            AND EXISTS (
              SELECT 1
              FROM "SpecialistWorkplace" w0
              WHERE w0."specialistId" = sp0.id
                AND w0."organizationId" = e0."organizationId"
                AND w0."isActive" = true
                AND w0."deletedAt" IS NULL
            )
        )
    `,
  );
  return rows.map((r) => r.serviceCategoryId);
}
