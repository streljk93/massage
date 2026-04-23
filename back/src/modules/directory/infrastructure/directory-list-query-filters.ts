import type { Prisma } from '@prisma/client';
import type { ApiLocale } from '../../../common/i18n';

const SEARCH_LOCALES: ApiLocale[] = ['en', 'vi', 'ru'];

function searchLocaleIn(): ApiLocale[] {
  return SEARCH_LOCALES;
}

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
  const locs = searchLocaleIn();
  return {
    OR: [
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { bio: { contains: q, mode: 'insensitive' } },
      { listingMetaLine: { contains: q, mode: 'insensitive' } },
      { listingServicesLine: { contains: q, mode: 'insensitive' } },
      {
        activeOrganization: {
          OR: [
            { addressLine: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { listingMetaLine: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        services: {
          some: {
            deletedAt: null,
            isActive: true,
            specialistId: { not: null },
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              {
                locales: {
                  some: {
                    locale: { in: locs },
                    name: { contains: q, mode: 'insensitive' },
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

function organizationTextSearchWhere(
  q: string,
  locale: ApiLocale,
): Prisma.OrganizationWhereInput {
  const locs = searchLocaleIn();
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { listingMetaLine: { contains: q, mode: 'insensitive' } },
      { listingServicesLine: { contains: q, mode: 'insensitive' } },
      { addressLine: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
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
      {
        services: {
          some: {
            deletedAt: null,
            isActive: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              {
                locales: {
                  some: {
                    locale: { in: locs },
                    name: { contains: q, mode: 'insensitive' },
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

/** Доп. условия к списку организаций (AND к базе + курсору). */
export function organizationListFiltersWhere(
  f: OrganizationListApiFilters,
): Prisma.OrganizationWhereInput {
  const and: Prisma.OrganizationWhereInput[] = [];

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

  const q = f.q?.trim();
  if (q) {
    and.push(organizationTextSearchWhere(q, f.locale));
  }

  if (and.length === 0) {
    return {};
  }
  return { AND: and };
}
