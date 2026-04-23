/** Параметры фильтрации для GET /organizations (экран поиска). */
export type SearchOrganizationsListApiFilters = {
  q: string;
  categorySlugs: string[];
};

/** Параметры для GET /specialists + диапазон VND по личным услугам. */
export type SearchSpecialistsListApiFilters =
  SearchOrganizationsListApiFilters & {
    priceMinVnd: number | null;
    priceMaxVnd: number | null;
  };

export function searchOrganizationsFiltersEmpty(
  f: SearchOrganizationsListApiFilters,
): boolean {
  return !f.q.trim() && f.categorySlugs.length === 0;
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
