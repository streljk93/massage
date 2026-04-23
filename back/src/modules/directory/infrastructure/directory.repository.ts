import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addMilliseconds, subHours } from 'date-fns';
import { LISTING_SLOT_WINDOW_MS } from '../../../common/availability/listing-slot-policy';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

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

function specialistIncludeForOrgEmployment() {
  return {
    user: { select: { id: true, name: true } },
    services: directoryServiceInclude,
  } satisfies Prisma.SpecialistInclude;
}

function specialistListInclude() {
  return {
    user: { select: { id: true, name: true } },
    serviceCategories: serviceCategoryWithLocales,
    /** Услуги каталога с `specialistId` = этот мастер. */
    services: directoryServiceInclude,
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
 * `ReturnType<typeof specialistListInclude>` в Prisma 7 + ESLint иногда даёт `never` в IDE.
 */
export const specialistListIncludeShape = specialistListInclude();

/**
 * То же для карточки организации (вложенный specialist).
 */
export const organizationListIncludeShape = organizationListInclude();

export type SpecialistListRow = Prisma.SpecialistGetPayload<{
  include: typeof specialistListIncludeShape;
}>;

export type OrganizationListRow = Prisma.OrganizationGetPayload<{
  include: typeof organizationListIncludeShape;
}>;

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
  ): Promise<{ specialistId: string; startsAt: Date; endsAt: Date }[]> {
    if (specialistIds.length === 0) {
      return Promise.resolve([]);
    }
    const windowStart = subHours(now, 1);
    const windowEnd = addMilliseconds(now, LISTING_SLOT_WINDOW_MS);
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

  findAllSpecialists(): Promise<SpecialistListRow[]> {
    return this.prisma.specialist.findMany({
      where: { deletedAt: null, listedInDirectory: true },
      include: specialistListInclude(),
      orderBy: { user: { name: 'asc' } },
    });
  }

  findAllOrganizations(): Promise<OrganizationListRow[]> {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      include: organizationListInclude(),
      orderBy: { name: 'asc' },
    });
  }

  findOrganizationById(id: string): Promise<OrganizationListRow | null> {
    return this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: organizationListInclude(),
    });
  }

  findSpecialistById(id: string): Promise<SpecialistListRow | null> {
    return this.prisma.specialist.findFirst({
      where: { id, deletedAt: null },
      include: specialistListInclude(),
    });
  }

  /** Подкатегории, которые есть у мастеров, показываемых в каталоге. */
  findDistinctServiceCategoryIdsForListingSpecialists(): Promise<string[]> {
    return this.prisma
      .$queryRaw<{ serviceCategoryId: string }[]>`
        SELECT DISTINCT ssc."serviceCategoryId"
        FROM "SpecialistServiceCategory" ssc
        INNER JOIN "Specialist" s ON s.id = ssc."specialistId"
        WHERE s."listedInDirectory" = true
          AND s."deletedAt" IS NULL
      `
      .then((rows) => rows.map((r) => r.serviceCategoryId));
  }

  /**
   * Подкатегории, проставленные у неудалённых организаций (витрина салонов).
   */
  findDistinctServiceCategoryIdsForListingOrganizations(): Promise<string[]> {
    return this.prisma
      .$queryRaw<{ serviceCategoryId: string }[]>`
        SELECT DISTINCT osc."serviceCategoryId"
        FROM "OrganizationServiceCategory" osc
        INNER JOIN "Organization" o ON o.id = osc."organizationId"
        WHERE o."deletedAt" IS NULL
      `
      .then((rows) => rows.map((r) => r.serviceCategoryId));
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
    const rows = await this.prisma.$queryRaw<{ min: number | null; max: number | null }[]>`
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
}
