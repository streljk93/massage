import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Полная пересборка `OrganizationServiceCategory`: подкатегории витрины салона = уникальные
 * `Service.categoryId` по активным услугам мастеров с `activeOrganizationId` = этот салон,
 * услуга в скоупе места приёма (`scope` = personal либо `organizationId` салона),
 * **и** `majorServiceCategoryId` категории входит в выбранные сферы организации
 * (`OrganizationMajorServiceCategory`).
 *
 * Так мы не переводим сами строки услуг в `isActive: false`, когда салон снимает сферу:
 * услуги остаются в каталоге мастера; для этой организации вертикаль просто не показывается.
 *
 * Пустой набор сфер у организации → OSC очищается (inner join на `OrganizationMajorServiceCategory`).
 *
 * Вызывать при CRUD/деактивации услуг, смене сфер/места приёма и т.д.
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
      INNER JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
      INNER JOIN "OrganizationMajorServiceCategory" omsc
        ON omsc."organizationId"::text = ${organizationId}
        AND omsc."majorServiceCategoryId" = sc."majorServiceCategoryId"
      WHERE sp."activeOrganizationId"::text = ${organizationId}
        AND sp."deletedAt" IS NULL
        AND s."deletedAt" IS NULL
        AND sc."deletedAt" IS NULL
        AND s."isActive" = true
        AND (
          s."scope" = 'personal'::"ServiceCatalogScope"
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
