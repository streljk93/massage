/** Вкладки сфер на карточке профиля: уникальные major + порядок из каталога. */
export type MajorSphereTabModel = {
  slug: string;
  name: string;
};

/** Собрать вкладки по полям услуги из GET directory (bookableServices). */
export function majorSphereTabsFromBookableRows(
  rows: ReadonlyArray<{
    majorSlug: string;
    majorName: string;
    majorSortOrder: number;
  }>,
): MajorSphereTabModel[] {
  const bySlug = new Map<
    string,
    { name: string; sortOrder: number }
  >();
  for (const row of rows) {
    const slug = row.majorSlug.trim();
    if (!slug) {
      continue;
    }
    const existing = bySlug.get(slug);
    const sortOrder =
      existing != null ?
        Math.min(existing.sortOrder, row.majorSortOrder)
      : row.majorSortOrder;
    const nameCandidate = row.majorName.trim() || slug;
    const name =
      existing?.name.trim() ?
        existing.name
      : nameCandidate;
    bySlug.set(slug, { name, sortOrder });
  }
  return [...bySlug.entries()]
    .sort((a, b) => {
      const ao = a[1].sortOrder;
      const bo = b[1].sortOrder;
      if (ao !== bo) {
        return ao - bo;
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([slug, v]) => ({ slug, name: v.name }));
}
