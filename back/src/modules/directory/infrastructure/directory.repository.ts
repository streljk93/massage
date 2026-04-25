import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { addMilliseconds, subHours } from 'date-fns';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  findOrganizationIdsWithinRadiusMeters,
  findSpecialistIdsWithinRadiusMeters,
} from './directory-geo-radius-ids';
import {
  organizationListFiltersWhere,
  specialistListFiltersWhere,
  type OrganizationListApiFilters,
  type SpecialistListApiFilters,
} from './directory-list-query-filters';
import type { DirectoryListRadiusFilter } from '../../../common/pagination/directory-list-radius-filter';
import type { DirectoryListSort } from '../../../common/pagination/directory-list-sort';
import type {
  DecodedOrganizationListCursor,
  DecodedOrganizationOffsetCursor,
  DecodedSpecialistListCursor,
  DecodedSpecialistOffsetCursor,
} from '../../../common/pagination/directory-list-cursor-codec';

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
    locales: true,
    category: { include: { locales: true } },
  },
} satisfies Prisma.ServiceFindManyArgs;

const specialistActiveOrganizationInclude = {
  select: {
    addressLine: true,
    city: true,
    latitude: true,
    longitude: true,
    listingMetaLine: true,
    listingWorkdayStartMinute: true,
    listingWorkdayEndMinute: true,
  },
} as const;

function specialistIncludeForOrgEmployment() {
  return {
    user: { select: { id: true, name: true } },
    services: directoryServiceInclude,
    activeOrganization: specialistActiveOrganizationInclude,
  } satisfies Prisma.SpecialistInclude;
}

function specialistListInclude() {
  return {
    user: { select: { id: true, name: true } },
    serviceCategories: serviceCategoryWithLocales,
    /** Услуги каталога с `specialistId` = этот мастер. */
    services: directoryServiceInclude,
    activeOrganization: specialistActiveOrganizationInclude,
  } satisfies Prisma.SpecialistInclude;
}

function organizationListInclude() {
  return {
    locales: true,
    serviceCategories: serviceCategoryWithLocales,
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
      { deletedAt: null, listedInDirectory: true },
    ];
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
      andParts.push({ id: { in: inRadius } });
    }
    if (filters != null) {
      const fw = specialistListFiltersWhere(filters);
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
    const andParts: Prisma.OrganizationWhereInput[] = [{ deletedAt: null }];
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
      andParts.push({ id: { in: inRadius } });
    }
    if (filters != null) {
      const fw = organizationListFiltersWhere(filters);
      if (Object.keys(fw).length > 0) {
        andParts.push(fw);
      }
    }
    return andParts;
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
            WHERE ssc."specialistId"::text IN (${Prisma.join(ids)})
              AND LOWER(sc.slug) IN (${Prisma.join(slugs)})
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
          SELECT sv."organizationId"::text AS "orgId", MIN(po."priceAmount")::int AS mp
          FROM "Service" sv
          INNER JOIN "ServicePriceOption" po ON po."serviceId" = sv.id
          WHERE sv."organizationId"::text IN (${Prisma.join(ids)})
            AND sv."deletedAt" IS NULL
            AND sv."isActive" = true
            AND po."currency" = 'VND'
          GROUP BY sv."organizationId"
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

  findOrganizationById(id: string): Promise<OrganizationListRow | null> {
    return this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: organizationListInclude(),
    });
  }

  findOrganizationsByIds(ids: string[]): Promise<OrganizationListRow[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.organization.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: organizationListInclude(),
    });
  }

  findSpecialistById(id: string): Promise<SpecialistListRow | null> {
    return this.prisma.specialist.findFirst({
      where: { id, deletedAt: null },
      include: specialistListInclude(),
    });
  }

  findSpecialistsByIds(ids: string[]): Promise<SpecialistListRow[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.specialist.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: specialistListInclude(),
    });
  }

  /** Подкатегории, которые есть у мастеров, показываемых в каталоге. */
  findDistinctServiceCategoryIdsForListingSpecialists(): Promise<string[]> {
    return this.prisma.$queryRaw<{ serviceCategoryId: string }[]>`
        SELECT DISTINCT ssc."serviceCategoryId"
        FROM "SpecialistServiceCategory" ssc
        INNER JOIN "Specialist" s ON s.id = ssc."specialistId"
        WHERE s."listedInDirectory" = true
          AND s."deletedAt" IS NULL
      `.then((rows) => rows.map((r) => r.serviceCategoryId));
  }

  /**
   * Подкатегории, проставленные у неудалённых организаций (витрина салонов).
   */
  findDistinctServiceCategoryIdsForListingOrganizations(): Promise<string[]> {
    return this.prisma.$queryRaw<{ serviceCategoryId: string }[]>`
        SELECT DISTINCT osc."serviceCategoryId"
        FROM "OrganizationServiceCategory" osc
        INNER JOIN "Organization" o ON o.id = osc."organizationId"
        WHERE o."deletedAt" IS NULL
      `.then((rows) => rows.map((r) => r.serviceCategoryId));
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
      INNER JOIN "Organization" o ON o.id = s."organizationId"
      INNER JOIN "Specialist" sp ON sp.id = s."specialistId"
      INNER JOIN "SpecialistOrganizationEmployment" e
        ON e."specialistId" = s."specialistId"
        AND e."organizationId" = s."organizationId"
        AND e."isActive" = true
      WHERE po."currency" = 'VND'
        AND s."deletedAt" IS NULL
        AND s."isActive" = true
        AND s."specialistId" IS NOT NULL
        AND o."deletedAt" IS NULL
        AND sp."deletedAt" IS NULL
        AND sp."listedInDirectory" = true
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
      where: { id, deletedAt: null },
      select: { id: true },
    });
  }

  async findOrganizationReviewsPage(args: {
    organizationId: string;
    limit: number;
    cursor: { createdAt: Date; id: string } | null;
  }): Promise<
    Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
      authorName: string;
    }>
  > {
    const base = {
      organizationId: args.organizationId,
      deletedAt: null,
    } satisfies Prisma.OrganizationReviewWhereInput;
    const where: Prisma.OrganizationReviewWhereInput =
      args.cursor == null
        ? base
        : {
            ...base,
            OR: [
              { createdAt: { lt: args.cursor.createdAt } },
              {
                AND: [
                  { createdAt: args.cursor.createdAt },
                  { id: { lt: args.cursor.id } },
                ],
              },
            ],
          };
    const rows = await this.prisma.organizationReview.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: args.limit,
      include: {
        author: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName: r.author.name,
    }));
  }

  async findSpecialistReviewsPage(args: {
    specialistId: string;
    limit: number;
    cursor: { createdAt: Date; id: string } | null;
  }): Promise<
    Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
      authorName: string;
    }>
  > {
    const base = {
      specialistId: args.specialistId,
      deletedAt: null,
    } satisfies Prisma.SpecialistReviewWhereInput;
    const where: Prisma.SpecialistReviewWhereInput =
      args.cursor == null
        ? base
        : {
            ...base,
            OR: [
              { createdAt: { lt: args.cursor.createdAt } },
              {
                AND: [
                  { createdAt: args.cursor.createdAt },
                  { id: { lt: args.cursor.id } },
                ],
              },
            ],
          };
    const rows = await this.prisma.specialistReview.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: args.limit,
      include: {
        author: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName: r.author.name,
    }));
  }
}
