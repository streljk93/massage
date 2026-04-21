import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

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

function specialistIncludeForOrgEmployment(now: Date) {
  return {
    user: { select: { id: true, name: true } },
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

@Injectable()
export class DirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

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
