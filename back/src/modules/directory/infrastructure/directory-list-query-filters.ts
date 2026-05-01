import type { Prisma } from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';

export type SpecialistListApiFilters = {
  /** `MajorServiceCategory.slug`; только мастера с подкатегориями в этой вертикали. */
  majorCategorySlug: string | null;
  q: string | null;
  categorySlugs: string[];
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
  locale: ApiLocale;
};

export type OrganizationListApiFilters = {
  majorCategorySlug: string | null;
  q: string | null;
  categorySlugs: string[];
  locale: ApiLocale;
};

function specialistTextSearchWhere(
  q: string,
  locale: ApiLocale,
): Prisma.SpecialistWhereInput {
  return {
    OR: [
      { listingName: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
      {
        activeOrganization: {
          is: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              {
                address: {
                  is: {
                    OR: [
                      { addressLine: { contains: q, mode: 'insensitive' } },
                      { city: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      {
        serviceCategories: {
          some: {
            serviceCategory: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { shortName: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
                {
                  locales: {
                    some: {
                      locale: { in: [locale, 'en'] },
                      OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { shortName: { contains: q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    ],
  };
}

/** Доп. условия к списку мастеров (AND к базе + курсору). */
export function specialistListFiltersWhere(
  f: SpecialistListApiFilters,
): Prisma.SpecialistWhereInput {
  const and: Prisma.SpecialistWhereInput[] = [];

  if (f.majorCategorySlug) {
    and.push({
      serviceCategories: {
        some: {
          serviceCategory: {
            deletedAt: null,
            isActive: true,
            majorServiceCategory: {
              slug: f.majorCategorySlug,
              deletedAt: null,
              isActive: true,
            },
          },
        },
      },
    });
  }

  if (f.categorySlugs.length > 0) {
    and.push({
      serviceCategories: {
        some: {
          serviceCategory: {
            slug: { in: f.categorySlugs },
            deletedAt: null,
            isActive: true,
          },
        },
      },
    });
  }

  if (f.priceMinVnd != null || f.priceMaxVnd != null) {
    const priceAmount: Prisma.IntFilter = {};
    if (f.priceMinVnd != null) {
      priceAmount.gte = f.priceMinVnd;
    }
    if (f.priceMaxVnd != null) {
      priceAmount.lte = f.priceMaxVnd;
    }
    and.push({
      services: {
        some: {
          deletedAt: null,
          isActive: true,
          specialistId: { not: null },
          priceOptions: {
            some: {
              currency: 'VND',
              priceAmount,
            },
          },
        },
      },
    });
  }

  const q = f.q?.trim();
  if (q) {
    and.push(specialistTextSearchWhere(q, f.locale));
  }

  if (and.length === 0) {
    return {};
  }
  return { AND: and };
}

/**
 * Текстовый поиск по полям организации без совпадения по подкатегориям.
 * Совпадение по подкатегориям в каталоге салонов — отдельно (только «витринные» OSC с покрытием мастером).
 */
export function organizationNonCategoryTextSearchWhere(
  q: string,
  locale: ApiLocale,
): Prisma.OrganizationWhereInput {
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      {
        address: { is: { addressLine: { contains: q, mode: 'insensitive' } } },
      },
      { address: { is: { city: { contains: q, mode: 'insensitive' } } } },
      {
        locales: {
          some: {
            locale: { in: [locale, 'en'] },
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ],
  };
}
