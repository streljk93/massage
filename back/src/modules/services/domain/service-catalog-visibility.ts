import { ServiceCatalogScope } from '@prisma/client';

/**
 * Услуга «на стойке салона» для текущего места приёма мастера: личный каталог (personal)
 * или каталог с `organizationId`, совпадающим с активным/текущим салоном.
 * Эквивалент условию витрины/sync: `scope = personal` или `organizationId` совпадает с салоном мастера.
 */
export function isSalonCounterServiceScope(args: {
  scope: ServiceCatalogScope;
  serviceOrganizationId: string | null;
  workplaceOrganizationId: string | null;
}): boolean {
  if (args.scope === ServiceCatalogScope.personal) {
    return args.serviceOrganizationId == null;
  }
  if (args.workplaceOrganizationId == null) {
    return false;
  }
  return args.serviceOrganizationId === args.workplaceOrganizationId;
}

export function isCategoryMajorInOrganizationSet(
  categoryMajorServiceCategoryId: string,
  organizationMajorCategoryIds: ReadonlySet<string>,
): boolean {
  return organizationMajorCategoryIds.has(categoryMajorServiceCategoryId);
}

/**
 * Проверка доступности услуги для клиентской записи в том же смысле, что витрина directory:
 * активная услуга, мастер в каталоге, скоуп рабочего места, подкатегория в сферах организации
 * (если есть контекст салона).
 */
export function isServiceBookableMatchingDirectoryVitrineRules(args: {
  scope: ServiceCatalogScope;
  serviceOrganizationId: string | null;
  categoryMajorServiceCategoryId: string;
  serviceIsActive: boolean;
  serviceDeletedAt: Date | null;
  specialistListedInDirectory: boolean;
  workplaceOrganizationId: string | null;
  /** Majors активной/разрешённой организации мастера; при отсутствии салона — null. */
  workplaceOrganizationMajorCategoryIds: string[] | null;
}): boolean {
  if (!args.serviceIsActive || args.serviceDeletedAt != null) {
    return false;
  }
  if (!args.specialistListedInDirectory) {
    return false;
  }
  if (
    !isSalonCounterServiceScope({
      scope: args.scope,
      serviceOrganizationId: args.serviceOrganizationId,
      workplaceOrganizationId: args.workplaceOrganizationId,
    })
  ) {
    return false;
  }
  if (args.workplaceOrganizationId == null) {
    return args.scope === ServiceCatalogScope.personal;
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
