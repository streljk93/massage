import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + LISTING_SLOT_WINDOW_MS);
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
}
