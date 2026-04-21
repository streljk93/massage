import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { formatOccupiedSlotKey } from '../domain/occupancy-slot-key';

const availabilityWhere = (
  now: Date,
): Prisma.SpecialistAvailabilitySlotWhereInput => ({
  isBooked: false,
  startsAt: {
    gte: new Date(now.getTime() - 60 * 60 * 1000),
    lte: new Date(now.getTime() + 48 * 60 * 60 * 1000),
  },
});

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

function specialistIncludeForOrgEmployment(now: Date) {
  return {
    user: { select: { id: true, name: true } },
    services: directoryServiceInclude,
    availabilitySlots: {
      where: availabilityWhere(now),
      orderBy: { startsAt: 'asc' as const },
      take: 24,
    },
  } satisfies Prisma.SpecialistInclude;
}

function specialistListInclude(now: Date) {
  return {
    user: { select: { id: true, name: true } },
    serviceCategories: serviceCategoryWithLocales,
    /** Услуги каталога с `specialistId` = этот мастер. */
    services: directoryServiceInclude,
    availabilitySlots: {
      where: availabilityWhere(now),
      orderBy: { startsAt: 'asc' as const },
      take: 40,
    },
  } satisfies Prisma.SpecialistInclude;
}

function organizationListInclude(now: Date) {
  return {
    locales: true,
    serviceCategories: serviceCategoryWithLocales,
    specialistEmployments: {
      where: { isActive: true },
      include: {
        specialist: {
          include: specialistIncludeForOrgEmployment(now),
        },
      },
    },
  } satisfies Prisma.OrganizationInclude;
}

/**
 * Образец `include` для `GetPayload`: дата в `availabilityWhere` не влияет на форму типа.
 * `ReturnType<typeof specialistListInclude>` в Prisma 7 + ESLint иногда даёт `never` в IDE.
 */
export const specialistListIncludeShape = specialistListInclude(new Date(0));

/**
 * То же для карточки организации (вложенный specialist + слоты).
 */
export const organizationListIncludeShape = organizationListInclude(
  new Date(0),
);

export type SpecialistListRow = Prisma.SpecialistGetPayload<{
  include: typeof specialistListIncludeShape;
}>;

export type OrganizationListRow = Prisma.OrganizationGetPayload<{
  include: typeof organizationListIncludeShape;
}>;

/** Активные записи: слот считается занятым до отмены / завершения. */
const ACTIVE_BOOKING_STATUSES: Array<
  'pending' | 'confirmed' | 'in_progress'
> = ['pending', 'confirmed', 'in_progress'];

@Injectable()
export class DirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ключи `день(VN)|HH:mm` по активным бронированиям в окне витрины (как у слотов).
   */
  async findOccupiedBookingKeysBySpecialistIds(
    specialistIds: string[],
    now: Date,
  ): Promise<Map<string, Set<string>>> {
    const result = new Map<string, Set<string>>();
    for (const id of specialistIds) {
      result.set(id, new Set());
    }
    if (specialistIds.length === 0) {
      return result;
    }
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const rows = await this.prisma.booking.findMany({
      where: {
        specialistId: { in: specialistIds },
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startsAt: { gte: windowStart, lte: windowEnd },
      },
      select: { specialistId: true, startsAt: true },
    });

    for (const r of rows) {
      const set = result.get(r.specialistId);
      if (!set) {
        continue;
      }
      set.add(formatOccupiedSlotKey(r.startsAt));
    }
    return result;
  }

  findAllSpecialists(now: Date): Promise<SpecialistListRow[]> {
    return this.prisma.specialist.findMany({
      where: { deletedAt: null, listedInDirectory: true },
      include: specialistListInclude(now),
      orderBy: { user: { name: 'asc' } },
    });
  }

  findAllOrganizations(now: Date): Promise<OrganizationListRow[]> {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      include: organizationListInclude(now),
      orderBy: { name: 'asc' },
    });
  }

  findOrganizationById(
    id: string,
    now: Date,
  ): Promise<OrganizationListRow | null> {
    return this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: organizationListInclude(now),
    });
  }

  findSpecialistById(id: string, now: Date): Promise<SpecialistListRow | null> {
    return this.prisma.specialist.findFirst({
      where: { id, deletedAt: null },
      include: specialistListInclude(now),
    });
  }
}
