import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  GalleryMediaKind,
  GalleryOwnerKind,
  Prisma,
  PublicationModerationStatus,
} from '@prisma/client';
import { addMilliseconds, subHours } from 'date-fns';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  directoryListedSpecialistListingNameWhereInput,
  specialistProfileListingWhereInput,
} from '../lib/directory-specialist-listed-profile';
import {
  findOrganizationIdsWithinRadiusMeters,
  findSpecialistIdsWithinRadiusMeters,
} from './directory-geo-radius-ids';
import {
  organizationNonCategoryTextSearchWhere,
  specialistListFiltersWhere,
  specialistNonCategoryTextSearchWhere,
  type OrganizationListApiFilters,
  type SpecialistListApiFilters,
} from './directory-list-query-filters';
import {
  queryDistinctStorefrontOrganizationServiceCategoryIds,
  queryOrganizationIdsInDirectoryWithCurrentWorkplaceSpecialists,
  queryOrganizationIdsMatchingStorefrontCategoryTextSearch,
  queryOrganizationIdsMatchingVitrineCategoryConstraints,
  queryOrganizationStorefrontCategoryPairs,
  querySpecialistIdsMatchingStorefrontCategoryConstraints,
  querySpecialistIdsMatchingStorefrontCategoryTextSearch,
  vitrineCategoryCoverageExists,
} from './organization-vitrine-category-coverage';
import type { DirectoryListRadiusFilter } from '../../../common/pagination/directory-list-radius-filter';
import type { DirectoryListSort } from '../../../common/pagination/directory-list-sort';
import type {
  DecodedOrganizationListCursor,
  DecodedOrganizationOffsetCursor,
  DecodedSpecialistListCursor,
  DecodedSpecialistOffsetCursor,
} from '../../../common/pagination/directory-list-cursor-codec';

/** Гость видит только одобренный текст; автор — ещё и свои отзывы на модерации / отклонённые. */
function moderationWhereOrganizationReview(
  viewerUserId: string | null,
): Prisma.OrganizationReviewWhereInput {
  if (viewerUserId == null) {
    return {
      publicationModerationStatus: PublicationModerationStatus.approved,
    };
  }
  return {
    OR: [
      { publicationModerationStatus: PublicationModerationStatus.approved },
      {
        AND: [
          { authorUserId: viewerUserId },
          {
            publicationModerationStatus: {
              in: [
                PublicationModerationStatus.pending_review,
                PublicationModerationStatus.rejected,
              ],
            },
          },
        ],
      },
    ],
  };
}

function moderationWhereSpecialistReview(
  viewerUserId: string | null,
): Prisma.SpecialistReviewWhereInput {
  if (viewerUserId == null) {
    return {
      publicationModerationStatus: PublicationModerationStatus.approved,
    };
  }
  return {
    OR: [
      { publicationModerationStatus: PublicationModerationStatus.approved },
      {
        AND: [
          { authorUserId: viewerUserId },
          {
            publicationModerationStatus: {
              in: [
                PublicationModerationStatus.pending_review,
                PublicationModerationStatus.rejected,
              ],
            },
          },
        ],
      },
    ],
  };
}

/** Текст отзыва для витрины: гости — только опубликованный; автор своего текста «на модерации» видит черновик. */
function directoryReviewListedComment(args: {
  viewerUserId: string | null;
  row: {
    authorUserId: string;
    publishedComment: string | null;
    pendingCommentDraft: string | null;
  };
}): string | null {
  const viewer = args.viewerUserId;
  const isAuthor = viewer != null && viewer === args.row.authorUserId;
  const draft = args.row.pendingCommentDraft?.trim() ?? '';
  if (isAuthor && draft !== '') {
    return args.row.pendingCommentDraft;
  }
  return args.row.publishedComment;
}

const serviceCategoryWithLocales = {
  include: {
    serviceCategory: {
      include: { locales: true },
    },
  },
} as const;

const directoryServiceInclude = {
  where: { deletedAt: null, isActive: true },
  orderBy: { sortOrder: 'asc' as const },
  include: {
    priceOptions: { orderBy: { durationMinutes: 'asc' as const } },
    category: {
      include: {
        locales: true,
        majorServiceCategory: { include: { locales: true } },
      },
    },
    comboItems: {
      orderBy: { sortOrder: 'asc' as const },
      include: {
        itemServiceCategory: {
          include: { locales: true },
        },
      },
    },
  },
} satisfies Prisma.ServiceFindManyArgs;

const directoryAddressForListSelect = {
  addressLine: true,
  city: true,
  latitude: true,
  longitude: true,
} as const;

const specialistActiveOrganizationInclude = {
  select: {
    id: true,
    name: true,
    address: { select: directoryAddressForListSelect },
    phone: true,
    listingWorkdayStartMinute: true,
    listingWorkdayEndMinute: true,
    publicationModerationStatus: true,
  },
} as const;

function specialistIncludeForOrgEmployment() {
  return {
    user: {
      select: {
        id: true,
        phone: true,
      },
    },
    services: directoryServiceInclude,
    activeOrganization: specialistActiveOrganizationInclude,
  } satisfies Prisma.SpecialistInclude;
}

function specialistListInclude() {
  return {
    user: {
      select: {
        id: true,
        phone: true,
      },
    },
    serviceCategories: serviceCategoryWithLocales,
    /** Услуги каталога с `specialistId` = этот мастер. */
    services: directoryServiceInclude,
    activeOrganization: specialistActiveOrganizationInclude,
  } satisfies Prisma.SpecialistInclude;
}

function organizationListInclude() {
  return {
    majorServiceCategories: {
      include: {
        majorServiceCategory: {
          select: { id: true, slug: true, sortOrder: true },
        },
      },
    },
    locales: true,
    serviceCategories: serviceCategoryWithLocales,
    address: { select: directoryAddressForListSelect },
    specialistEmployments: {
      where: { isActive: true },
      include: {
        specialist: {
          include: specialistIncludeForOrgEmployment(),
        },
      },
    },
  } satisfies Prisma.OrganizationInclude;
}

/**
 * Образец `include` для `GetPayload`.
 * `typeof *IncludeShape` + глубокий nested include в Prisma 7 иногда даёт `error`/`never` в
 * type-aware ESLint; `Prisma.validator` стабилизирует тип для `GetPayload`.
 */
const specialistListPayloadArgs =
  Prisma.validator<Prisma.SpecialistDefaultArgs>()({
    include: specialistListInclude(),
  });

const organizationListPayloadArgs =
  Prisma.validator<Prisma.OrganizationDefaultArgs>()({
    include: organizationListInclude(),
  });

export type SpecialistListRow = Prisma.SpecialistGetPayload<{
  include: typeof specialistListPayloadArgs.include;
}>;

export type OrganizationListRow = Prisma.OrganizationGetPayload<{
  include: typeof organizationListPayloadArgs.include;
}>;

export const specialistListIncludeShape = specialistListPayloadArgs.include;

export const organizationListIncludeShape = organizationListPayloadArgs.include;

export type { DirectoryListRadiusFilter };

const DIRECTORY_OFFSET_SORTS: ReadonlySet<DirectoryListSort> = new Set([
  'recommended',
  'price_asc',
  'price_desc',
]);

function specialistListOrderBy(
  sort: DirectoryListSort,
): Prisma.SpecialistOrderByWithRelationInput[] {
  if (DIRECTORY_OFFSET_SORTS.has(sort)) {
    return [{ id: 'asc' }];
  }
  if (sort === 'newest') {
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
  if (sort === 'rating') {
    return [{ ratingAverage: 'desc' }, { id: 'asc' }];
  }
  return [{ reviewsCount: 'desc' }, { ratingAverage: 'desc' }, { id: 'asc' }];
}

function organizationListOrderBy(
  sort: DirectoryListSort,
): Prisma.OrganizationOrderByWithRelationInput[] {
  if (DIRECTORY_OFFSET_SORTS.has(sort)) {
    return [{ id: 'asc' }];
  }
  if (sort === 'newest') {
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
  if (sort === 'rating') {
    return [{ ratingAverage: 'desc' }, { id: 'asc' }];
  }
  return [{ reviewsCount: 'desc' }, { ratingAverage: 'desc' }, { id: 'asc' }];
}

function specialistListCursorWhere(
  sort: DirectoryListSort,
  cursor: DecodedSpecialistListCursor,
): Prisma.SpecialistWhereInput {
  if (sort === 'popularity') {
    const c = cursor as Extract<
      DecodedSpecialistListCursor,
      { sort: 'popularity' }
    >;
    const { reviewsCount, id } = c;
    if (c.ratingAverage == null) {
      return {
        OR: [
          { reviewsCount: { lt: reviewsCount } },
          { AND: [{ reviewsCount: reviewsCount }, { id: { gt: id } }] },
        ],
      };
    }
    const { ratingAverage } = c;
    return {
      OR: [
        { reviewsCount: { lt: reviewsCount } },
        {
          AND: [
            { reviewsCount: reviewsCount },
            { ratingAverage: { lt: ratingAverage } },
          ],
        },
        {
          AND: [
            { reviewsCount: reviewsCount },
            { ratingAverage: ratingAverage },
            { id: { gt: id } },
          ],
        },
      ],
    };
  }
  if (sort === 'newest') {
    const { createdAtIso, id } = cursor as Extract<
      DecodedSpecialistListCursor,
      { sort: 'newest' }
    >;
    const t = new Date(createdAtIso);
    return {
      OR: [
        { createdAt: { lt: t } },
        { AND: [{ createdAt: t }, { id: { lt: id } }] },
      ],
    };
  }
  const { ratingAverage, id } = cursor as Extract<
    DecodedSpecialistListCursor,
    { sort: 'rating' }
  >;
  return {
    OR: [
      { ratingAverage: { lt: ratingAverage } },
      { AND: [{ ratingAverage: ratingAverage }, { id: { gt: id } }] },
    ],
  };
}

function organizationListCursorWhere(
  sort: DirectoryListSort,
  cursor: DecodedOrganizationListCursor,
): Prisma.OrganizationWhereInput {
  if (sort === 'popularity') {
    const c = cursor as Extract<
      DecodedOrganizationListCursor,
      { sort: 'popularity' }
    >;
    const { reviewsCount, id } = c;
    if (c.ratingAverage == null) {
      return {
        OR: [
          { reviewsCount: { lt: reviewsCount } },
          { AND: [{ reviewsCount: reviewsCount }, { id: { gt: id } }] },
        ],
      };
    }
    const { ratingAverage } = c;
    return {
      OR: [
        { reviewsCount: { lt: reviewsCount } },
        {
          AND: [
            { reviewsCount: reviewsCount },
            { ratingAverage: { lt: ratingAverage } },
          ],
        },
        {
          AND: [
            { reviewsCount: reviewsCount },
            { ratingAverage: ratingAverage },
            { id: { gt: id } },
          ],
        },
      ],
    };
  }
  if (sort === 'newest') {
    const { createdAtIso, id } = cursor as Extract<
      DecodedOrganizationListCursor,
      { sort: 'newest' }
    >;
    const t = new Date(createdAtIso);
    return {
      OR: [
        { createdAt: { lt: t } },
        { AND: [{ createdAt: t }, { id: { lt: id } }] },
      ],
    };
  }
  const { ratingAverage, id } = cursor as Extract<
    DecodedOrganizationListCursor,
    { sort: 'rating' }
  >;
  return {
    OR: [
      { ratingAverage: { lt: ratingAverage } },
      { AND: [{ ratingAverage: ratingAverage }, { id: { gt: id } }] },
    ],
  };
}

/** Активные записи: интервал брони занимает слоты до отмены / завершения. */
const ACTIVE_BOOKING_STATUSES: Array<'pending' | 'confirmed' | 'in_progress'> =
  ['pending', 'confirmed', 'in_progress'];

const SPECIALIST_LIST_CAP = 8000;

@Injectable()
export class DirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async specialistDirectoryAndParts(
    filters: SpecialistListApiFilters | null,
    radius: DirectoryListRadiusFilter | null,
  ): Promise<Prisma.SpecialistWhereInput[] | null> {
    const andParts: Prisma.SpecialistWhereInput[] = [
      {
        AND: [
          {
            deletedAt: null,
            listedInDirectory: true,
            activeOrganizationId: { not: null },
            activeOrganization: {
              deletedAt: null,
              publicationModerationStatus: PublicationModerationStatus.approved,
            },
          },
          directoryListedSpecialistListingNameWhereInput(),
          specialistProfileListingWhereInput(),
        ],
      },
    ];
    /** Сужение id: радиус → пересечение с витринным SSC∩OSC для фильтра категорий. */
    let mergedRestrictIds: string[] | null = null;
    if (radius != null) {
      const inRadius = await findSpecialistIdsWithinRadiusMeters(
        this.prisma,
        radius.centerLat,
        radius.centerLng,
        radius.radiusM,
      );
      if (inRadius.length === 0) {
        return null;
      }
      mergedRestrictIds = inRadius;
    }

    let filtersForFw: SpecialistListApiFilters | null = filters;

    if (filters != null) {
      const hasCat =
        (filters.majorCategorySlug != null &&
          filters.majorCategorySlug.trim() !== '') ||
        filters.categorySlugs.length > 0;
      const qTrim = filters.q?.trim() ?? '';

      if (hasCat) {
        const catIds =
          await querySpecialistIdsMatchingStorefrontCategoryConstraints(
            this.prisma,
            {
              majorCategorySlug: filters.majorCategorySlug,
              categorySlugs: filters.categorySlugs,
              restrictToSpecialistIds: mergedRestrictIds,
            },
          );
        if (catIds.length === 0) {
          return null;
        }
        mergedRestrictIds = catIds;
      }

      if (qTrim.length > 0) {
        const catTextHits =
          await querySpecialistIdsMatchingStorefrontCategoryTextSearch(
            this.prisma,
            qTrim,
            filters.locale,
            mergedRestrictIds,
          );
        andParts.push({
          OR: [
            specialistNonCategoryTextSearchWhere(qTrim),
            { id: { in: catTextHits } },
          ],
        });
        filtersForFw = {
          ...filters,
          q: null,
          ...(hasCat
            ? {
                majorCategorySlug: null,
                categorySlugs: [] as string[],
              }
            : {}),
        };
      } else if (hasCat) {
        filtersForFw = {
          ...filters,
          majorCategorySlug: null,
          categorySlugs: [] as string[],
        };
      }
    }

    if (mergedRestrictIds != null) {
      andParts.push({ id: { in: mergedRestrictIds } });
    }

    if (filtersForFw != null) {
      const fw = specialistListFiltersWhere(filtersForFw);
      if (Object.keys(fw).length > 0) {
        andParts.push(fw);
      }
    }
    return andParts;
  }

  private async organizationDirectoryAndParts(
    filters: OrganizationListApiFilters | null,
    radius: DirectoryListRadiusFilter | null,
  ): Promise<Prisma.OrganizationWhereInput[] | null> {
    let radiusIds: string[] | null = null;
    const andParts: Prisma.OrganizationWhereInput[] = [
      {
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
    ];
    if (radius != null) {
      const inRadius = await findOrganizationIdsWithinRadiusMeters(
        this.prisma,
        radius.centerLat,
        radius.centerLng,
        radius.radiusM,
      );
      if (inRadius.length === 0) {
        return null;
      }
      radiusIds = inRadius;
    }
    const workplaceOrgIds =
      await queryOrganizationIdsInDirectoryWithCurrentWorkplaceSpecialists(
        this.prisma,
        radiusIds,
      );
    if (workplaceOrgIds.length === 0) {
      return null;
    }
    andParts.push({ id: { in: workplaceOrgIds } });
    if (filters == null) {
      return andParts;
    }
    const hasCat =
      (filters.majorCategorySlug != null && filters.majorCategorySlug !== '') ||
      filters.categorySlugs.length > 0;
    const hasBodyZones = filters.bodyZoneSlugs.length > 0;
    const q = filters.q?.trim() ?? '';

    if (hasCat) {
      const ids = await queryOrganizationIdsMatchingVitrineCategoryConstraints(
        this.prisma,
        {
          majorCategorySlug: filters.majorCategorySlug,
          categorySlugs: filters.categorySlugs,
          restrictToOrganizationIds: radiusIds,
        },
      );
      if (ids.length === 0) {
        return null;
      }
      andParts.push({ id: { in: ids } });
    }

    if (q.length > 0) {
      const catHitIds =
        await queryOrganizationIdsMatchingStorefrontCategoryTextSearch(
          this.prisma,
          q,
          filters.locale,
          null,
        );
      const nonCat = organizationNonCategoryTextSearchWhere(q, filters.locale);
      const branches = [
        ...(Array.isArray(nonCat.OR) ? nonCat.OR : []),
        { id: { in: catHitIds } },
      ];
      andParts.push({ OR: branches });
    }

    if (hasBodyZones) {
      andParts.push({
        specialistEmployments: {
          some: {
            isActive: true,
            specialist: {
              deletedAt: null,
              listedInDirectory: true,
              activeOrganizationId: { not: null },
              activeOrganization: {
                deletedAt: null,
                publicationModerationStatus:
                  PublicationModerationStatus.approved,
              },
              services: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  bodyZones: {
                    some: {
                      bodyZone: {
                        deletedAt: null,
                        isActive: true,
                        slug: { in: [...filters.bodyZoneSlugs, 'full-body'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    return andParts;
  }

  /** Подкатегории OSC, которые реально показываются на витрине (есть мастер с услугой VND). */
  findOrganizationStorefrontCategoryIdMap(
    organizationIds: string[],
  ): Promise<Map<string, Set<string>>> {
    return queryOrganizationStorefrontCategoryPairs(
      this.prisma,
      organizationIds,
    );
  }

  /**
   * Рекомендации, цена: полная сортировка в памяти, курсор = offset.
   */
  private async findSpecialistsOffsetSortedPage(args: {
    take: number;
    sort: 'recommended' | 'price_asc' | 'price_desc';
    offset: number;
    filters: SpecialistListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
    overlapCategorySlugs: string[];
  }): Promise<SpecialistListRow[]> {
    const andParts = await this.specialistDirectoryAndParts(
      args.filters,
      args.radius,
    );
    if (andParts == null) {
      return [];
    }
    const where: Prisma.SpecialistWhereInput = { AND: andParts };
    const candidates = await this.prisma.specialist.findMany({
      where,
      select: {
        id: true,
        ratingAverage: true,
        reviewsCount: true,
        createdAt: true,
      },
      take: SPECIALIST_LIST_CAP,
      orderBy: { id: 'asc' },
    });
    if (candidates.length === 0) {
      return [];
    }
    const ids = candidates.map((c) => c.id);
    const byId = new Map(candidates.map((c) => [c.id, c] as const));
    let orderedIds: string[] = [];
    if (args.sort === 'recommended') {
      const slugs = args.overlapCategorySlugs
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const overlap = new Map<string, number>();
      if (slugs.length > 0) {
        const rows = await this.prisma.$queryRaw<
          { specialistId: string; cnt: number }[]
        >(
          Prisma.sql`
            SELECT ssc."specialistId"::text AS "specialistId", COUNT(*)::int AS cnt
            FROM "SpecialistServiceCategory" ssc
            INNER JOIN "ServiceCategory" sc ON sc.id = ssc."serviceCategoryId"
            INNER JOIN "Specialist" sp ON sp.id = ssc."specialistId"
            INNER JOIN "OrganizationServiceCategory" osc
              ON osc."organizationId" = sp."activeOrganizationId"
              AND osc."serviceCategoryId" = sc.id
            WHERE ssc."specialistId"::text IN (${Prisma.join(ids)})
              AND LOWER(sc.slug) IN (${Prisma.join(slugs)})
              AND sp."deletedAt" IS NULL
              AND sp."activeOrganizationId" IS NOT NULL
              AND ${vitrineCategoryCoverageExists()}
            GROUP BY ssc."specialistId"
          `,
        );
        for (const r of rows) {
          overlap.set(r.specialistId, r.cnt);
        }
      }
      orderedIds = [...ids].sort((a, b) => {
        const oa = overlap.get(a) ?? 0;
        const ob = overlap.get(b) ?? 0;
        if (ob !== oa) {
          return ob - oa;
        }
        const ra = byId.get(a)!.ratingAverage;
        const rb = byId.get(b)!.ratingAverage;
        if (rb !== ra) {
          return rb - ra;
        }
        return a.localeCompare(b);
      });
    } else {
      const rows = await this.prisma.$queryRaw<
        { specId: string; mp: number | null }[]
      >(
        Prisma.sql`
          SELECT sv."specialistId"::text AS "specId", MIN(po."priceAmount")::int AS mp
          FROM "Service" sv
          INNER JOIN "ServicePriceOption" po ON po."serviceId" = sv.id
          WHERE sv."specialistId"::text IN (${Prisma.join(ids)})
            AND sv."deletedAt" IS NULL
            AND sv."isActive" = true
            AND po."currency" = 'VND'
          GROUP BY sv."specialistId"
        `,
      );
      const minPrice = new Map<string, number | null>();
      for (const id of ids) {
        minPrice.set(id, null);
      }
      for (const r of rows) {
        minPrice.set(r.specId, r.mp);
      }
      const desc = args.sort === 'price_desc';
      orderedIds = [...ids].sort((a, b) => {
        const pa = minPrice.get(a) ?? null;
        const pb = minPrice.get(b) ?? null;
        if (pa == null && pb == null) {
          return a.localeCompare(b);
        }
        if (pa == null) {
          return 1;
        }
        if (pb == null) {
          return -1;
        }
        if (pa !== pb) {
          return desc ? pb - pa : pa - pb;
        }
        return a.localeCompare(b);
      });
    }
    const slice = orderedIds.slice(args.offset, args.offset + args.take + 1);
    if (slice.length === 0) {
      return [];
    }
    const rowsFull = await this.prisma.specialist.findMany({
      where: { id: { in: slice } },
      include: specialistListInclude(),
    });
    const orderIndex = new Map(slice.map((id, i) => [id, i]));
    return [...rowsFull].sort(
      (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
    );
  }

  private async findOrganizationsOffsetSortedPage(args: {
    take: number;
    sort: 'recommended' | 'price_asc' | 'price_desc';
    offset: number;
    filters: OrganizationListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
    overlapCategorySlugs: string[];
  }): Promise<OrganizationListRow[]> {
    const andParts = await this.organizationDirectoryAndParts(
      args.filters,
      args.radius,
    );
    if (andParts == null) {
      return [];
    }
    const where: Prisma.OrganizationWhereInput = { AND: andParts };
    const candidates = await this.prisma.organization.findMany({
      where,
      select: {
        id: true,
        ratingAverage: true,
        reviewsCount: true,
        createdAt: true,
      },
      take: SPECIALIST_LIST_CAP,
      orderBy: { id: 'asc' },
    });
    if (candidates.length === 0) {
      return [];
    }
    const ids = candidates.map((c) => c.id);
    const byId = new Map(candidates.map((c) => [c.id, c] as const));
    let orderedIds: string[] = [];
    if (args.sort === 'recommended') {
      const slugs = args.overlapCategorySlugs
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const overlap = new Map<string, number>();
      if (slugs.length > 0) {
        const rows = await this.prisma.$queryRaw<
          { organizationId: string; cnt: number }[]
        >(
          Prisma.sql`
            SELECT osc."organizationId"::text AS "organizationId", COUNT(*)::int AS cnt
            FROM "OrganizationServiceCategory" osc
            INNER JOIN "ServiceCategory" sc ON sc.id = osc."serviceCategoryId"
            WHERE osc."organizationId"::text IN (${Prisma.join(ids)})
              AND LOWER(sc.slug) IN (${Prisma.join(slugs)})
              AND ${vitrineCategoryCoverageExists()}
            GROUP BY osc."organizationId"
          `,
        );
        for (const r of rows) {
          overlap.set(r.organizationId, r.cnt);
        }
      }
      orderedIds = [...ids].sort((a, b) => {
        const oa = overlap.get(a) ?? 0;
        const ob = overlap.get(b) ?? 0;
        if (ob !== oa) {
          return ob - oa;
        }
        const ra = byId.get(a)!.ratingAverage;
        const rb = byId.get(b)!.ratingAverage;
        if (rb !== ra) {
          return rb - ra;
        }
        return a.localeCompare(b);
      });
    } else {
      const rows = await this.prisma.$queryRaw<
        { orgId: string; mp: number | null }[]
      >(
        Prisma.sql`
          SELECT e."organizationId"::text AS "orgId", MIN(po."priceAmount")::int AS mp
          FROM "SpecialistOrganizationEmployment" e
          INNER JOIN "Specialist" sp ON sp.id = e."specialistId"
          INNER JOIN "Service" sv ON sv."specialistId" = e."specialistId"
            AND sv."deletedAt" IS NULL
            AND sv."isActive" = true
            AND (sv."organizationId" IS NULL OR sv."organizationId" = e."organizationId")
          INNER JOIN "ServicePriceOption" po ON po."serviceId" = sv.id AND po."currency" = 'VND'
          WHERE e."isActive" = true
            AND e."organizationId"::text IN (${Prisma.join(ids)})
            AND sp."listedInDirectory" = true
            AND sp."deletedAt" IS NULL
            AND sp."activeOrganizationId" IS NOT NULL
            AND sp."activeOrganizationId" = e."organizationId"
          GROUP BY e."organizationId"
        `,
      );
      const minPrice = new Map<string, number | null>();
      for (const id of ids) {
        minPrice.set(id, null);
      }
      for (const r of rows) {
        minPrice.set(r.orgId, r.mp);
      }
      const desc = args.sort === 'price_desc';
      orderedIds = [...ids].sort((a, b) => {
        const pa = minPrice.get(a) ?? null;
        const pb = minPrice.get(b) ?? null;
        if (pa == null && pb == null) {
          return a.localeCompare(b);
        }
        if (pa == null) {
          return 1;
        }
        if (pb == null) {
          return -1;
        }
        if (pa !== pb) {
          return desc ? pb - pa : pa - pb;
        }
        return a.localeCompare(b);
      });
    }
    const slice = orderedIds.slice(args.offset, args.offset + args.take + 1);
    if (slice.length === 0) {
      return [];
    }
    const rowsFull = await this.prisma.organization.findMany({
      where: { id: { in: slice } },
      include: organizationListInclude(),
    });
    const orderIndex = new Map(slice.map((id, i) => [id, i]));
    return [...rowsFull].sort(
      (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
    );
  }

  /**
   * Брони, пересекающиеся с окном витрины слотов (горизонт как у вычисляемых слотов).
   */
  findActiveBookingsForListingOccupancy(
    specialistIds: string[],
    now: Date,
    previewWindowMs: number,
  ): Promise<{ specialistId: string; startsAt: Date; endsAt: Date }[]> {
    if (specialistIds.length === 0) {
      return Promise.resolve([]);
    }
    const windowStart = subHours(now, 1);
    const windowEnd = addMilliseconds(now, previewWindowMs);
    return this.prisma.booking.findMany({
      where: {
        specialistId: { in: specialistIds },
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { specialistId: true, startsAt: true, endsAt: true },
    });
  }

  async findSpecialistsPage(args: {
    take: number;
    sort: DirectoryListSort;
    cursor: DecodedSpecialistListCursor | null;
    filters: SpecialistListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
    /** Пересечение slug подкатегорий с портретом (сортировка `recommended`). */
    overlapCategorySlugs?: string[];
  }): Promise<SpecialistListRow[]> {
    if (DIRECTORY_OFFSET_SORTS.has(args.sort)) {
      const off =
        args.cursor == null
          ? 0
          : (args.cursor as DecodedSpecialistOffsetCursor).offset;
      return this.findSpecialistsOffsetSortedPage({
        take: args.take,
        sort: args.sort as 'recommended' | 'price_asc' | 'price_desc',
        offset: off,
        filters: args.filters,
        radius: args.radius,
        overlapCategorySlugs: args.overlapCategorySlugs ?? [],
      });
    }
    const base = await this.specialistDirectoryAndParts(
      args.filters,
      args.radius,
    );
    if (base == null) {
      return [];
    }
    const andParts: Prisma.SpecialistWhereInput[] = [...base];
    if (args.cursor != null) {
      andParts.push(specialistListCursorWhere(args.sort, args.cursor));
    }
    return await this.prisma.specialist.findMany({
      where: { AND: andParts },
      take: args.take,
      include: specialistListInclude(),
      orderBy: specialistListOrderBy(args.sort),
    });
  }

  async findOrganizationsPage(args: {
    take: number;
    sort: DirectoryListSort;
    cursor: DecodedOrganizationListCursor | null;
    filters: OrganizationListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
    overlapCategorySlugs?: string[];
  }): Promise<OrganizationListRow[]> {
    if (DIRECTORY_OFFSET_SORTS.has(args.sort)) {
      const off =
        args.cursor == null
          ? 0
          : (args.cursor as DecodedOrganizationOffsetCursor).offset;
      return this.findOrganizationsOffsetSortedPage({
        take: args.take,
        sort: args.sort as 'recommended' | 'price_asc' | 'price_desc',
        offset: off,
        filters: args.filters,
        radius: args.radius,
        overlapCategorySlugs: args.overlapCategorySlugs ?? [],
      });
    }
    const base = await this.organizationDirectoryAndParts(
      args.filters,
      args.radius,
    );
    if (base == null) {
      return [];
    }
    const andParts: Prisma.OrganizationWhereInput[] = [...base];
    if (args.cursor != null) {
      andParts.push(organizationListCursorWhere(args.sort, args.cursor));
    }
    return await this.prisma.organization.findMany({
      where: { AND: andParts },
      take: args.take,
      include: organizationListInclude(),
      orderBy: organizationListOrderBy(args.sort),
    });
  }

  async findOrganizationById(id: string): Promise<OrganizationListRow | null> {
    const eligible =
      await queryOrganizationIdsInDirectoryWithCurrentWorkplaceSpecialists(
        this.prisma,
        [id],
      );
    if (eligible.length === 0) {
      return null;
    }
    return this.prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
      include: organizationListInclude(),
    });
  }

  /**
   * Карточка салона: публично — только витрина + `approved`; владелец (`ownerUserId`) видит
   * профиль независимо от модерации (для превью и статуса).
   */
  async findOrganizationByIdForDirectoryDetail(
    id: string,
    viewerUserId: string | null,
  ): Promise<OrganizationListRow | null> {
    const head = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { ownerUserId: true },
    });
    if (!head) {
      return null;
    }
    const isOwner =
      viewerUserId != null &&
      head.ownerUserId != null &&
      head.ownerUserId === viewerUserId;

    if (isOwner) {
      return this.prisma.organization.findFirst({
        where: { id, deletedAt: null },
        include: organizationListInclude(),
      });
    }

    return this.findOrganizationById(id);
  }

  /**
   * Публичное чтение витринной галереи организации (без авторизации).
   */
  async findOrganizationVitrineGalleryItemsPublic(
    organizationId: string,
  ): Promise<Array<{ url: string; alt: string | null }>> {
    const gallery = await this.prisma.gallery.findUnique({
      where: {
        ownerKind_ownerId: {
          ownerKind: GalleryOwnerKind.organization,
          ownerId: organizationId,
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          select: { url: true, alt: true },
        },
      },
    });
    if (!gallery) {
      return [];
    }
    return gallery.items.map((it) => ({ url: it.url, alt: it.alt }));
  }

  async findOrganizationsByIds(ids: string[]): Promise<OrganizationListRow[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    const eligible =
      await queryOrganizationIdsInDirectoryWithCurrentWorkplaceSpecialists(
        this.prisma,
        ids,
      );
    if (eligible.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.organization.findMany({
      where: {
        id: { in: eligible },
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
      include: organizationListInclude(),
    });
  }

  findSpecialistById(id: string): Promise<SpecialistListRow | null> {
    return this.prisma.specialist.findFirst({
      where: {
        id,
        deletedAt: null,
        activeOrganization: {
          deletedAt: null,
          publicationModerationStatus: PublicationModerationStatus.approved,
        },
        AND: [
          directoryListedSpecialistListingNameWhereInput(),
          specialistProfileListingWhereInput(),
        ],
      },
      include: specialistListInclude(),
    });
  }

  /** Витрина: только мастер, участвующий в каталоге (место приёма + флаг + модерация). */
  findPublicDirectorySpecialistById(
    id: string,
  ): Promise<SpecialistListRow | null> {
    return this.prisma.specialist.findFirst({
      where: {
        id,
        deletedAt: null,
        listedInDirectory: true,
        activeOrganizationId: { not: null },
        activeOrganization: {
          deletedAt: null,
          publicationModerationStatus: PublicationModerationStatus.approved,
        },
        AND: [
          directoryListedSpecialistListingNameWhereInput(),
          specialistProfileListingWhereInput(),
        ],
      },
      include: specialistListInclude(),
    });
  }

  /**
   * Профиль специалиста: гость — только публичный каталог (`findPublicDirectorySpecialistById`);
   * сам пользователь‑мастер видит свой профиль независимо от модерации салона/листа.
   */
  async findSpecialistByIdForDirectoryDetail(
    id: string,
    viewerUserId: string | null,
  ): Promise<SpecialistListRow | null> {
    const head = await this.prisma.specialist.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!head) {
      return null;
    }
    const isOwner = viewerUserId != null && head.userId === viewerUserId;

    if (isOwner) {
      return this.prisma.specialist.findFirst({
        where: { id, deletedAt: null },
        include: specialistListInclude(),
      });
    }

    return this.findPublicDirectorySpecialistById(id);
  }

  findSpecialistsByIds(ids: string[]): Promise<SpecialistListRow[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.specialist.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        AND: [
          directoryListedSpecialistListingNameWhereInput(),
          specialistProfileListingWhereInput(),
        ],
      },
      include: specialistListInclude(),
    });
  }

  /** Подкатегории, которые есть у мастеров, показываемых в каталоге. */
  findDistinctServiceCategoryIdsForListingSpecialists(): Promise<string[]> {
    return this.prisma.specialist
      .findMany({
        where: {
          deletedAt: null,
          listedInDirectory: true,
          AND: [
            directoryListedSpecialistListingNameWhereInput(),
            specialistProfileListingWhereInput(),
          ],
        },
        select: {
          serviceCategories: {
            select: { serviceCategoryId: true },
          },
        },
      })
      .then((rows) => {
        const ids = new Set<string>();
        for (const row of rows) {
          for (const c of row.serviceCategories) {
            ids.add(c.serviceCategoryId);
          }
        }
        return [...ids];
      });
  }

  /**
   * Подкатегории, проставленные у неудалённых организаций (витрина салонов).
   */
  findDistinctServiceCategoryIdsForListingOrganizations(): Promise<string[]> {
    return queryDistinctStorefrontOrganizationServiceCategoryIds(this.prisma);
  }

  async findDistinctBodyZoneIdsForListingSpecialists(): Promise<string[]> {
    const rows = await this.prisma.serviceBodyZone.findMany({
      where: {
        service: {
          deletedAt: null,
          isActive: true,
          specialistId: { not: null },
          specialist: {
            deletedAt: null,
            listedInDirectory: true,
          },
        },
        bodyZone: {
          deletedAt: null,
          isActive: true,
        },
      },
      select: { bodyZoneId: true },
      distinct: ['bodyZoneId'],
    });
    return rows.map((r) => r.bodyZoneId);
  }

  async findDistinctBodyZoneIdsForListingOrganizations(): Promise<string[]> {
    const rows = await this.prisma.serviceBodyZone.findMany({
      where: {
        service: {
          deletedAt: null,
          isActive: true,
          specialistId: { not: null },
          specialist: {
            deletedAt: null,
            listedInDirectory: true,
            activeOrganizationId: { not: null },
          },
        },
        bodyZone: {
          deletedAt: null,
          isActive: true,
        },
      },
      select: { bodyZoneId: true },
      distinct: ['bodyZoneId'],
    });
    return rows.map((r) => r.bodyZoneId);
  }

  findServiceCategoriesByIds(ids: string[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.serviceCategory.findMany({
      where: { id: { in: ids }, deletedAt: null, isActive: true },
      include: { locales: { orderBy: { locale: 'asc' } } },
    });
  }

  findServiceCategoriesByMajorSlug(majorSlug: string) {
    return this.prisma.serviceCategory.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        majorServiceCategory: {
          slug: majorSlug,
          deletedAt: null,
          isActive: true,
        },
      },
      include: { locales: { orderBy: { locale: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });
  }

  findBodyZonesByIds(ids: string[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.bodyZone.findMany({
      where: { id: { in: ids }, deletedAt: null, isActive: true },
      include: { locales: { orderBy: { locale: 'asc' } } },
    });
  }

  findBodyZonesByMajorSlug(majorSlug: string) {
    return this.prisma.bodyZone.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        majorServiceCategory: {
          slug: majorSlug,
          deletedAt: null,
          isActive: true,
        },
      },
      include: { locales: { orderBy: { locale: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });
  }

  /**
   * Min/max VND по личным услугам мастеров (Service.specialistId), показываемым в каталоге.
   */
  async aggregateVndPriceBoundsForListingSpecialists(): Promise<{
    min: number | null;
    max: number | null;
  }> {
    const a = await this.prisma.servicePriceOption.aggregate({
      where: {
        currency: 'VND',
        service: {
          deletedAt: null,
          isActive: true,
          specialistId: { not: null },
          specialist: {
            deletedAt: null,
            listedInDirectory: true,
          },
        },
      },
      _min: { priceAmount: true },
      _max: { priceAmount: true },
    });
    return { min: a._min.priceAmount, max: a._max.priceAmount };
  }

  /**
   * Min/max VND: услуги в салоне, оказываемые мастером с активной привязкой к этому салону.
   */
  async aggregateVndPriceBoundsForOrgListingServices(): Promise<{
    min: number | null;
    max: number | null;
  }> {
    const rows = await this.prisma.$queryRaw<
      { min: number | null; max: number | null }[]
    >`
      SELECT
        (MIN(po."priceAmount"))::int AS "min",
        (MAX(po."priceAmount"))::int AS "max"
      FROM "ServicePriceOption" po
      INNER JOIN "Service" s ON s.id = po."serviceId"
      INNER JOIN "SpecialistOrganizationEmployment" e
        ON e."specialistId" = s."specialistId"
        AND e."isActive" = true
        AND (s."organizationId" IS NULL OR s."organizationId" = e."organizationId")
      INNER JOIN "Specialist" sp ON sp.id = s."specialistId"
      WHERE po."currency" = 'VND'
        AND s."deletedAt" IS NULL
        AND s."isActive" = true
        AND s."specialistId" IS NOT NULL
        AND sp."deletedAt" IS NULL
        AND sp."listedInDirectory" = true
        AND sp."activeOrganizationId" IS NOT NULL
        AND sp."activeOrganizationId" = e."organizationId"
    `;
    const r = rows[0];
    return { min: r?.min ?? null, max: r?.max ?? null };
  }

  /**
   * Уникальные клиенты, у которых есть хотя бы одна `done` бронь в этом салоне.
   */
  countDistinctDoneClientsForOrganization(
    organizationId: string,
  ): Promise<number> {
    return this.prisma.user.count({
      where: {
        clientBookings: {
          some: {
            organizationId,
            deletedAt: null,
            status: BookingStatus.done,
          },
        },
      },
    });
  }

  /**
   * Уникальные клиенты по `done` брони на мастеров (для витрины/профиля).
   */
  async countDistinctDoneClientsBySpecialistIds(
    specialistIds: string[],
  ): Promise<Map<string, number>> {
    if (specialistIds.length === 0) {
      return new Map();
    }
    const pairs = await this.prisma.booking.findMany({
      where: {
        specialistId: { in: specialistIds },
        status: BookingStatus.done,
        deletedAt: null,
      },
      distinct: ['specialistId', 'clientUserId'],
      select: { specialistId: true, clientUserId: true },
    });
    const out = new Map<string, number>();
    for (const p of pairs) {
      out.set(p.specialistId, (out.get(p.specialistId) ?? 0) + 1);
    }
    return out;
  }

  findActiveOrganizationId(id: string): Promise<{ id: string } | null> {
    return this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
  }

  findActiveSpecialistId(id: string): Promise<{ id: string } | null> {
    return this.prisma.specialist.findFirst({
      where: {
        id,
        deletedAt: null,
        listedInDirectory: true,
        activeOrganizationId: { not: null },
      },
      select: { id: true },
    });
  }

  /**
   * Список отзывов салона доступен только для опубликованного салона или владельца (профиль скрыт).
   */
  async canViewerAccessOrganizationReviews(
    organizationId: string,
    viewerUserId: string | null,
  ): Promise<boolean> {
    const o = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { ownerUserId: true, publicationModerationStatus: true },
    });
    if (!o) {
      return false;
    }
    if (
      o.publicationModerationStatus === PublicationModerationStatus.approved
    ) {
      return true;
    }
    return (
      viewerUserId != null &&
      o.ownerUserId != null &&
      o.ownerUserId === viewerUserId
    );
  }

  /**
   * Аналогично салону: публично — профиль есть в каталоге; автор отзыва — всегда.
   */
  async canViewerAccessSpecialistReviews(
    specialistId: string,
    viewerUserId: string | null,
  ): Promise<boolean> {
    const s = await this.prisma.specialist.findFirst({
      where: { id: specialistId, deletedAt: null },
      select: { userId: true },
    });
    if (!s) {
      return false;
    }
    if (viewerUserId != null && s.userId === viewerUserId) {
      return true;
    }
    return (await this.findPublicDirectorySpecialistById(specialistId)) != null;
  }

  async findOrganizationReviewsPage(args: {
    organizationId: string;
    limit: number;
    cursor: { createdAt: Date; id: string } | null;
    /** Автор видит свои отзывы с незавершённой модерацией; остальные — только одобренные. */
    viewerUserId?: string | null;
  }): Promise<
    Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
      authorName: string;
      publicationModerationStatus: PublicationModerationStatus;
    }>
  > {
    const moderationWhere = moderationWhereOrganizationReview(
      args.viewerUserId ?? null,
    );
    const identityWhere = {
      AND: [
        { organizationId: args.organizationId },
        { deletedAt: null },
        moderationWhere,
      ],
    } satisfies Prisma.OrganizationReviewWhereInput;
    const where: Prisma.OrganizationReviewWhereInput =
      args.cursor == null
        ? identityWhere
        : {
            AND: [
              identityWhere,
              {
                OR: [
                  { createdAt: { lt: args.cursor.createdAt } },
                  {
                    AND: [
                      { createdAt: args.cursor.createdAt },
                      { id: { lt: args.cursor.id } },
                    ],
                  },
                ],
              },
            ],
          };
    const rows = await this.prisma.organizationReview.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: args.limit,
      select: {
        id: true,
        rating: true,
        publishedComment: true,
        pendingCommentDraft: true,
        authorUserId: true,
        createdAt: true,
        publicationModerationStatus: true,
        author: { select: { name: true } },
      },
    });
    const viewerUid = args.viewerUserId ?? null;
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: directoryReviewListedComment({
        viewerUserId: viewerUid,
        row: r,
      }),
      createdAt: r.createdAt,
      authorName: r.author.name,
      publicationModerationStatus: r.publicationModerationStatus,
    }));
  }

  async findSpecialistReviewsPage(args: {
    specialistId: string;
    limit: number;
    cursor: { createdAt: Date; id: string } | null;
    viewerUserId?: string | null;
  }): Promise<
    Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
      authorName: string;
      publicationModerationStatus: PublicationModerationStatus;
    }>
  > {
    const moderationWhere = moderationWhereSpecialistReview(
      args.viewerUserId ?? null,
    );
    const identityWhere = {
      AND: [
        { specialistId: args.specialistId },
        { deletedAt: null },
        moderationWhere,
      ],
    } satisfies Prisma.SpecialistReviewWhereInput;
    const where: Prisma.SpecialistReviewWhereInput =
      args.cursor == null
        ? identityWhere
        : {
            AND: [
              identityWhere,
              {
                OR: [
                  { createdAt: { lt: args.cursor.createdAt } },
                  {
                    AND: [
                      { createdAt: args.cursor.createdAt },
                      { id: { lt: args.cursor.id } },
                    ],
                  },
                ],
              },
            ],
          };
    const rows = await this.prisma.specialistReview.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: args.limit,
      select: {
        id: true,
        rating: true,
        publishedComment: true,
        pendingCommentDraft: true,
        authorUserId: true,
        createdAt: true,
        publicationModerationStatus: true,
        author: { select: { name: true } },
      },
    });
    const viewerUid = args.viewerUserId ?? null;
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: directoryReviewListedComment({
        viewerUserId: viewerUid,
        row: r,
      }),
      createdAt: r.createdAt,
      authorName: r.author.name,
      publicationModerationStatus: r.publicationModerationStatus,
    }));
  }

  /**
   * Для витрины организации: первое изображение в галерее по `sortOrder` (обложка в списках).
   */
  async findStorefrontImageFieldsForOrganizationIds(
    ids: string[],
  ): Promise<
    Map<string, { imageUrl: string | null; imageAlt: string | null }>
  > {
    const out = new Map<
      string,
      { imageUrl: string | null; imageAlt: string | null }
    >();
    for (const id of ids) {
      out.set(id, { imageUrl: null, imageAlt: null });
    }
    if (ids.length === 0) {
      return out;
    }
    const galleries = await this.prisma.gallery.findMany({
      where: {
        ownerKind: GalleryOwnerKind.organization,
        ownerId: { in: ids },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true, alt: true, kind: true },
        },
      },
    });
    for (const g of galleries) {
      const first = g.items[0];
      if (first?.kind === GalleryMediaKind.image) {
        out.set(g.ownerId, {
          imageUrl: first.url,
          imageAlt: first.alt ?? null,
        });
      } else {
        out.set(g.ownerId, { imageUrl: null, imageAlt: null });
      }
    }
    return out;
  }
}
