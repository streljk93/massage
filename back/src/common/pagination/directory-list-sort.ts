import { BadRequestException } from '@nestjs/common';

/** Сортировка витрины: рекомендации (авторизованные + персонализация), популярность, новизна, цена, рейтинг. */
export const DIRECTORY_LIST_SORT_VALUES = [
  'recommended',
  'popularity',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
] as const;

export type DirectoryListSort = (typeof DIRECTORY_LIST_SORT_VALUES)[number];

/** По умолчанию — по числу отзывов; при равном числе — выше средний рейтинг. */
export const DIRECTORY_LIST_DEFAULT_SORT: DirectoryListSort = 'popularity';

function isDirectoryListSort(s: string): s is DirectoryListSort {
  return (DIRECTORY_LIST_SORT_VALUES as readonly string[]).includes(s);
}

/** Старые значения query до смены набора сортировок. */
const LEGACY_SORT_MAP: Readonly<Record<string, DirectoryListSort>> = {
  name_asc: 'popularity',
  name_desc: 'popularity',
  rating_desc: 'rating',
};

/**
 * `sort` в GET /specialists и /organizations. Пустой query — `popularity`.
 * Устаревшие: `name_asc`, `name_desc`, `rating_desc` маппятся на новые.
 */
export function parseDirectoryListSort(
  raw: string | undefined,
): DirectoryListSort {
  if (raw === undefined || raw.trim() === '') {
    return DIRECTORY_LIST_DEFAULT_SORT;
  }
  const t = raw.trim().toLowerCase();
  const legacy = LEGACY_SORT_MAP[t];
  if (legacy != null) {
    return legacy;
  }
  if (isDirectoryListSort(t)) {
    return t;
  }
  throw new BadRequestException({
    code: 'INVALID_SORT',
    message:
      'sort must be one of: recommended, popularity, newest, price_asc, price_desc, rating',
  });
}
