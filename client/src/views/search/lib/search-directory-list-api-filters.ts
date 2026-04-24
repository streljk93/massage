/** Параметры фильтрации для GET /organizations (экран поиска). */
export type SearchOrganizationsListApiFilters = {
  q: string;
  categorySlugs: string[];
  /** Согласовано с `search-url-filters`: все три вместе, иначе null. */
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
};

/** Параметры для GET /specialists + диапазон VND по личным услугам. */
export type SearchSpecialistsListApiFilters =
  SearchOrganizationsListApiFilters & {
    priceMinVnd: number | null;
    priceMaxVnd: number | null;
  };

export function searchDirectoryRadiusActive(f: {
  radiusM: number | null;
  radiusLat: number | null;
  radiusLng: number | null;
}): boolean {
  return (
    f.radiusM != null && f.radiusLat != null && f.radiusLng != null
  );
}

export function searchOrganizationsFiltersEmpty(
  f: SearchOrganizationsListApiFilters,
): boolean {
  return (
    !f.q.trim() &&
    f.categorySlugs.length === 0 &&
    !searchDirectoryRadiusActive(f)
  );
}

export function searchSpecialistsFiltersEmpty(
  f: SearchSpecialistsListApiFilters,
): boolean {
  return (
    searchOrganizationsFiltersEmpty(f) &&
    f.priceMinVnd == null &&
    f.priceMaxVnd == null
  );
}

export function searchCategoriesQueryCsv(slugs: string[]): string {
  return [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join(",");
}
