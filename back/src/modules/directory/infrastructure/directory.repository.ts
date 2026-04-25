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

export type DirectoryListRadiusFilter = {
  centerLat: number;
  centerLng: number;
  radiusM: number;
};

/** Активные записи: интервал брони занимает слоты до отмены / завершения. */
const ACTIVE_BOOKING_STATUSES: Array<'pending' | 'confirmed' | 'in_progress'> =
  ['pending', 'confirmed', 'in_progress'];

@Injectable()
export class DirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    cursor: { userName: string; id: string } | null;
    filters: SpecialistListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
  }): Promise<SpecialistListRow[]> {
    const andParts: Prisma.SpecialistWhereInput[] = [
      { deletedAt: null, listedInDirectory: true },
    ];
    if (args.radius != null) {
      const inRadius = await findSpecialistIdsWithinRadiusMeters(
        this.prisma,
        args.radius.centerLat,
        args.radius.centerLng,
        args.radius.radiusM,
      );
      if (inRadius.length === 0) {
        return [];
      }
      andParts.push({ id: { in: inRadius } });
    }
    if (args.cursor != null) {
      andParts.push({
        OR: [
          { user: { name: { gt: args.cursor.userName } } },
          {
            AND: [
              { user: { name: args.cursor.userName } },
              { id: { gt: args.cursor.id } },
            ],
          },
        ],
      });
    }
    if (args.filters != null) {
      const fw = specialistListFiltersWhere(args.filters);
      if (Object.keys(fw).length > 0) {
        andParts.push(fw);
      }
    }
    return await this.prisma.specialist.findMany({
      where: { AND: andParts },
      take: args.take,
      include: specialistListInclude(),
      orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    });
  }

  async findOrganizationsPage(args: {
    take: number;
    cursor: { name: string; id: string } | null;
    filters: OrganizationListApiFilters | null;
    radius: DirectoryListRadiusFilter | null;
  }): Promise<OrganizationListRow[]> {
    const andParts: Prisma.OrganizationWhereInput[] = [{ deletedAt: null }];
    if (args.radius != null) {
      const inRadius = await findOrganizationIdsWithinRadiusMeters(
        this.prisma,
        args.radius.centerLat,
        args.radius.centerLng,
        args.radius.radiusM,
      );
      if (inRadius.length === 0) {
        return [];
      }
      andParts.push({ id: { in: inRadius } });
    }
    if (args.cursor != null) {
      andParts.push({
        OR: [
          { name: { gt: args.cursor.name } },
          {
            AND: [{ name: args.cursor.name }, { id: { gt: args.cursor.id } }],
          },
        ],
      });
    }
    if (args.filters != null) {
      const fw = organizationListFiltersWhere(args.filters);
      if (Object.keys(fw).length > 0) {
        andParts.push(fw);
      }
    }
    return await this.prisma.organization.findMany({
      where: { AND: andParts },
      take: args.take,
      include: organizationListInclude(),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
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
