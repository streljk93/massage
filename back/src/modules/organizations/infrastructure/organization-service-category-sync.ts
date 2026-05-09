import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Полная пересборка `OrganizationServiceCategory` из **опубликованных** офферов точки,
 * чьи подкатегории входят в выбранные сферы (`OrganizationMajorServiceCategory`).
 * Личный каталог мастера (`Service`) на витрину салона не влияет.
 */
export async function syncOrganizationServiceCategoriesFromPublishedOfferings(
  db: PrismaService | Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const rows = await db.$queryRaw<{ categoryId: string }[]>(
    Prisma.sql`
      SELECT DISTINCT o."categoryId"::text AS "categoryId"
      FROM "OrganizationOffering" o
      INNER JOIN "ServiceCategory" sc ON sc.id = o."categoryId"
      INNER JOIN "OrganizationMajorServiceCategory" omsc
        ON omsc."organizationId" = o."organizationId"
        AND omsc."majorServiceCategoryId" = sc."majorServiceCategoryId"
      WHERE o."organizationId"::text = ${organizationId}
        AND o."deletedAt" IS NULL
        AND o."publicationStatus" = 'published'::"OfferingPublicationStatus"
        AND sc."deletedAt" IS NULL
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
