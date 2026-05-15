import { getAllowedBodyZoneSlugsForCategorySlug } from "./body-zone-compatibility";

/** Строка каталога зон (как из API `catalogGetBodyZonesByMajorSlug`). */
export type BodyZoneCatalogRow = {
  slug: string;
  name: string;
};

/**
 * Опции для `BodyZonesSelector`: пересечение каталога (порядок как в API) и карты допустимых зон
 * для slug категории услуг. Селектор остаётся «глупым» — только список `zones`.
 */
export function bodyZoneSelectOptionsForServiceCategorySlug(
  catalogOrdered: ReadonlyArray<BodyZoneCatalogRow>,
  serviceCategorySlug: string | null | undefined,
): BodyZoneCatalogRow[] {
  const allowed = new Set(getAllowedBodyZoneSlugsForCategorySlug(serviceCategorySlug));
  if (allowed.size === 0) {
    return [];
  }
  return catalogOrdered
    .filter((row) => allowed.has(row.slug))
    .map((row) => ({ slug: row.slug, name: row.name }));
}
