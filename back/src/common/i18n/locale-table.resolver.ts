import type { ApiLocale } from './api-locale';

type LocaleRow = { locale: string };

/**
 * Одно строковое поле из `*Locale`: запрошенная локаль → `en` → значение из `fallback`.
 */
export function resolveLocalizedString<
  L extends LocaleRow & Record<string, unknown>,
>(
  locale: ApiLocale,
  rows: L[],
  pick: (row: L) => string | null | undefined,
  fallback: string,
): string {
  const hit = rows.find((r) => r.locale === locale);
  const fromHit = hit ? pick(hit) : undefined;
  if (fromHit != null && fromHit !== '') {
    return fromHit;
  }
  const enRow = rows.find((r) => r.locale === 'en');
  const fromEn = enRow ? pick(enRow) : undefined;
  if (fromEn != null && fromEn !== '') {
    return fromEn;
  }
  return fallback;
}

export function pickLocalizedMajorName(
  row: { name: string; locales: { locale: string; name: string }[] },
  locale: ApiLocale,
): string {
  return resolveLocalizedString(locale, row.locales, (l) => l.name, row.name);
}

export type CategoryLocaleShape = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  locales: {
    locale: string;
    name: string;
    shortName: string;
    description: string | null;
  }[];
};

/** Организация со списком `OrganizationLocale` для витрины. */
export type OrganizationLocaleListShape = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  ratingAverage: number;
  reviewsCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
  locales: {
    locale: string;
    name: string;
    description: string | null;
  }[];
};

export function pickLocalizedOrganizationListItem(
  row: OrganizationLocaleListShape,
  locale: ApiLocale,
): Omit<OrganizationLocaleListShape, 'locales'> {
  const tr = row.locales.find((l) => l.locale === locale);
  if (tr) {
    return {
      id: row.id,
      slug: row.slug,
      name: tr.name,
      description: tr.description ?? row.description,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      ratingAverage: row.ratingAverage,
      reviewsCount: row.reviewsCount,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
    };
  }
  const en = row.locales.find((l) => l.locale === 'en');
  if (en) {
    return {
      id: row.id,
      slug: row.slug,
      name: en.name,
      description: en.description ?? row.description,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      ratingAverage: row.ratingAverage,
      reviewsCount: row.reviewsCount,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
    };
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    ratingAverage: row.ratingAverage,
    reviewsCount: row.reviewsCount,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
  };
}

export function pickLocalizedServiceCategoryFields(
  cat: CategoryLocaleShape,
  locale: ApiLocale,
): Pick<
  CategoryLocaleShape,
  'id' | 'name' | 'shortName' | 'slug' | 'description' | 'sortOrder'
> {
  const tr = cat.locales.find((l) => l.locale === locale);
  if (tr) {
    return {
      id: cat.id,
      name: tr.name,
      shortName: tr.shortName,
      slug: cat.slug,
      description: tr.description ?? cat.description,
      sortOrder: cat.sortOrder,
    };
  }
  const en = cat.locales.find((l) => l.locale === 'en');
  if (en) {
    return {
      id: cat.id,
      name: en.name,
      shortName: en.shortName,
      slug: cat.slug,
      description: en.description ?? cat.description,
      sortOrder: cat.sortOrder,
    };
  }
  return {
    id: cat.id,
    name: cat.name,
    shortName: cat.shortName,
    slug: cat.slug,
    description: cat.description,
    sortOrder: cat.sortOrder,
  };
}
