/**
 * Сортировка списка на поиске (GET /specialists, GET /organizations).
 * Значения совпадают с query `sort` на бэкенде.
 */
export const SEARCH_DIRECTORY_LIST_SORT_BASE_VALUES = [
  "popularity",
  "newest",
  "price_asc",
  "price_desc",
  "rating",
] as const;

/** `recommended` в конце: в селекте на поиске первыми — популярность и остальные базовые, затем рекомендации. */
export const SEARCH_DIRECTORY_LIST_SORT_VALUES = [
  ...SEARCH_DIRECTORY_LIST_SORT_BASE_VALUES,
  "recommended",
] as const;

export type SearchDirectoryListSort =
  (typeof SEARCH_DIRECTORY_LIST_SORT_VALUES)[number];

export const SEARCH_DIRECTORY_DEFAULT_SORT: SearchDirectoryListSort = "popularity";

const LEGACY_URL_SORT: Record<string, SearchDirectoryListSort> = {
  name_asc: "popularity",
  name_desc: "popularity",
  rating_desc: "rating",
};

const KNOWN_SORT = new Set<string>([
  ...SEARCH_DIRECTORY_LIST_SORT_VALUES,
  ...Object.keys(LEGACY_URL_SORT),
]);

/**
 * `sort` из URL. Легаси-значения (имя, старый рейтинг) маппятся на новые.
 */
export function parseSearchDirectoryListSort(
  raw: string | null | undefined,
): SearchDirectoryListSort {
  const t = raw?.trim().toLowerCase() ?? "";
  if (t === "" || t === SEARCH_DIRECTORY_DEFAULT_SORT) {
    return SEARCH_DIRECTORY_DEFAULT_SORT;
  }
  if (t in LEGACY_URL_SORT) {
    return LEGACY_URL_SORT[t]!;
  }
  if (KNOWN_SORT.has(t)) {
    return t as SearchDirectoryListSort;
  }
  return SEARCH_DIRECTORY_DEFAULT_SORT;
}

/**
 * Список из URL + факт, можно ли на клиенте вызывать `sort=recommended` (токен + готовность персонализации).
 * Пока `personalizationReady === undefined` (мета не загружена) — `recommended` понижается к `popularity`, чтобы не слать 4xx.
 */
export function effectiveSearchDirectoryListSort(
  urlSort: SearchDirectoryListSort,
  options: {
    accessToken: string;
    personalizationReady: boolean | undefined;
  },
): SearchDirectoryListSort {
  if (urlSort !== "recommended") {
    return urlSort;
  }
  if (!options.accessToken) {
    return "popularity";
  }
  if (options.personalizationReady === undefined) {
    return "popularity";
  }
  if (!options.personalizationReady) {
    return "popularity";
  }
  return "recommended";
}

/** Первая страница с SSR / без Bearer: `recommended` в URL не котируем в публичный API. */
export function searchDirectoryListSortForPublicApi(
  sort: SearchDirectoryListSort,
): SearchDirectoryListSort {
  return sort === "recommended" ? "popularity" : sort;
}

/** Ключи i18n namespace `search` — подпись выбранной сортировки без ожидания `SelectItem` в портале. */
export type SearchSortMessageKey =
  | "sortRecommended"
  | "sortPopularity"
  | "sortNewest"
  | "sortPriceAsc"
  | "sortPriceDesc"
  | "sortRating";

const SEARCH_SORT_I18N: Record<SearchDirectoryListSort, SearchSortMessageKey> =
  {
    recommended: "sortRecommended",
    popularity: "sortPopularity",
    newest: "sortNewest",
    price_asc: "sortPriceAsc",
    price_desc: "sortPriceDesc",
    rating: "sortRating",
  };

export function searchSortMessageKey(
  sort: SearchDirectoryListSort,
): SearchSortMessageKey {
  return SEARCH_SORT_I18N[sort] ?? "sortPopularity";
}

/** Параметры фильтрации для GET /organizations (экран поиска). */
export type SearchOrganizationsListApiFilters = {
  q: string;
  categorySlugs: string[];
  bodyZoneSlugs: string[];
  sort: SearchDirectoryListSort;
  /** Согласовано с `search-url-filters`: все три вместе, иначе null. */
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
};

/** Параметры для GET /specialists + диапазон VND по личным услугам. */
export type SearchSpecialistsListApiFilters = SearchOrganizationsListApiFilters & {
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
  gender: "male" | "female" | null;
};

export function searchDirectoryRadiusActive(f: {
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
}): boolean {
  return f.radiusM != null && f.radiusLat != null && f.radiusLng != null;
}

export function searchOrganizationsFiltersEmpty(
  f: SearchOrganizationsListApiFilters,
): boolean {
  return (
    !f.q.trim() &&
    f.categorySlugs.length === 0 &&
    f.bodyZoneSlugs.length === 0 &&
    !searchDirectoryRadiusActive(f) &&
    f.sort === SEARCH_DIRECTORY_DEFAULT_SORT
  );
}

export function searchSpecialistsFiltersEmpty(
  f: SearchSpecialistsListApiFilters,
): boolean {
  return (
    searchOrganizationsFiltersEmpty(f) &&
    f.gender == null &&
    f.priceMinVnd == null &&
    f.priceMaxVnd == null
  );
}

export function searchCategoriesQueryCsv(slugs: string[]): string {
  return [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join(",");
}
