/**
 * Подкатегория оффера входит в сферы (majors), разрешённые для организации точки приёма.
 */
export function isCategoryMajorInOrganizationSet(
  categoryMajorServiceCategoryId: string,
  organizationMajorCategoryIds: ReadonlySet<string>,
): boolean {
  return organizationMajorCategoryIds.has(categoryMajorServiceCategoryId);
}

/**
 * Запись гостем по SKU точки допустима только если мастер в каталоге, оффер принадлежит тому же салону,
 * что активное место приёма, и major подкатегории указан среди majors организации (непустой список).
 * Публикация оффера и активность цены проверяются вызывающим кодом.
 */
export function isOrganizationOfferingBookableMatchingDirectoryVitrineRules(args: {
  offeringOrganizationId: string;
  categoryMajorServiceCategoryId: string;
  specialistListedInDirectory: boolean;
  workplaceOrganizationId: string | null;
  workplaceOrganizationMajorCategoryIds: string[] | null;
}): boolean {
  if (!args.specialistListedInDirectory) {
    return false;
  }
  if (args.workplaceOrganizationId == null) {
    return false;
  }
  if (args.offeringOrganizationId !== args.workplaceOrganizationId) {
    return false;
  }
  const majors = args.workplaceOrganizationMajorCategoryIds ?? [];
  if (majors.length === 0) {
    return false;
  }
  return isCategoryMajorInOrganizationSet(
    args.categoryMajorServiceCategoryId,
    new Set(majors),
  );
}
