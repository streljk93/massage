import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CategoryLocaleShape } from '../../../common/i18n';

/**
 * Услуги, которые должны считаться «в салоне» при снятии больших категорий:
 * активные строки каталога мастера с текущим `activeOrganizationId` = салон и
 * услуги в скоупе этого салона (`organizationId` null — личный каталог у стойки или id салона).
 * Должен совпадать по смыслу с отбором в `syncOrganizationServiceCategoriesFromSpecialistServices`.
 */
export async function findActiveSalonScopedServicesAffectedByRemovingMajorCategories(
  db: PrismaService | Prisma.TransactionClient,
  organizationId: string,
  removedMajorCategoryIds: string[],
): Promise<
  Array<{
    id: string;
    category: CategoryLocaleShape;
  }>
> {
  if (removedMajorCategoryIds.length === 0) {
    return [];
  }
  return db.service.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      specialistId: { not: null },
      specialist: {
        deletedAt: null,
        activeOrganizationId: organizationId,
      },
      AND: [
        {
          OR: [{ organizationId: null }, { organizationId }],
        },
      ],
      category: {
        deletedAt: null,
        majorServiceCategoryId: { in: removedMajorCategoryIds },
      },
    },
    select: {
      id: true,
      category: {
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          description: true,
          sortOrder: true,
          locales: {
            select: {
              locale: true,
              name: true,
              shortName: true,
              description: true,
            },
          },
        },
      },
    },
  });
}

/**
 * При **добавлении** больших категорий к салону: снова включить (`isActive: true`) услуги того же скоупа,
 * что при снятии мажоров (`findActiveSalonScopedServicesAffectedByRemovingMajorCategories`), если
 * подкатегория относится к одному из новых мажоров и строка сейчас неактивна.
 */
export async function reactivateSalonScopedServicesForAddedMajorCategories(
  db: PrismaService | Prisma.TransactionClient,
  organizationId: string,
  addedMajorCategoryIds: string[],
): Promise<number> {
  if (addedMajorCategoryIds.length === 0) {
    return 0;
  }
  const result = await db.service.updateMany({
    where: {
      deletedAt: null,
      isActive: false,
      specialistId: { not: null },
      specialist: {
        deletedAt: null,
        activeOrganizationId: organizationId,
      },
      AND: [
        {
          OR: [{ organizationId: null }, { organizationId }],
        },
      ],
      category: {
        deletedAt: null,
        majorServiceCategoryId: { in: addedMajorCategoryIds },
      },
    },
    data: { isActive: true },
  });
  return result.count;
}

/**
 * Полная пересборка `OrganizationServiceCategory`: множество OSC для салона = уникальные `Service.categoryId`,
 * где услуга активна, мастер с `activeOrganizationId` = этот салон, а услуга в скоупе салона
 * (`organizationId` null — личный каталог — или совпадает с салоном).
 *
 * В одной логике: удалить все OSC по организации и вставить актуальный набор (идемпотентно).
 * Пустой набор желаемых категорий → удалить все OSC.
 *
 * Вызывать при CRUD/деактивации услуг, смене активного салона (старом и новом id) и т.д.
 */
export async function syncOrganizationServiceCategoriesFromSpecialistServices(
  db: PrismaService | Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const rows = await db.$queryRaw<{ categoryId: string }[]>(
    Prisma.sql`
      SELECT DISTINCT s."categoryId"::text AS "categoryId"
      FROM "Service" s
      INNER JOIN "Specialist" sp ON sp.id = s."specialistId"
      WHERE sp."activeOrganizationId"::text = ${organizationId}
        AND sp."deletedAt" IS NULL
        AND s."deletedAt" IS NULL
        AND s."isActive" = true
        AND (
          s."organizationId" IS NULL
          OR s."organizationId"::text = ${organizationId}
        )
    `,
  );
  await db.organizationServiceCategory.deleteMany({
    where: { organizationId },
  });
  if (rows.length === 0) {
    return;
  }
  await db.organizationServiceCategory.createMany({
    data: rows.map((r) => ({
      organizationId,
      serviceCategoryId: r.categoryId,
    })),
  });
}
