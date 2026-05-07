/**
 * Сферы деятельности организации: большие категории каталога через
 * `OrganizationMajorServiceCategory` (N:M).
 */

export type OrganizationMajorSnapshotRow = {
  majorServiceCategories: Array<{
    majorServiceCategory: { id: string; slug: string; sortOrder: number };
  }>;
};

export function mergeOrganizationMajorIdsAndSlugsFromDb(
  org: OrganizationMajorSnapshotRow,
): { ids: string[]; slugs: string[] } {
  const merged = org.majorServiceCategories
    .map((row) => row.majorServiceCategory)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.slug.localeCompare(b.slug, undefined, { sensitivity: 'base' }),
    );
  return {
    ids: merged.map((x) => x.id),
    slugs: merged.map((x) => x.slug),
  };
}
