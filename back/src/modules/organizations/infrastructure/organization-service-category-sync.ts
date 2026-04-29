import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Дополняет `OrganizationServiceCategory`: любая подкатегория из **активных** услуг мастеров,
 * у которых `activeOrganizationId` = этот салон (личный каталог `organizationId` null или услуги салона),
 * считается объявленной организацией — без ручного совпадения с формой при создании салона.
 *
 * Пересчитывает по **всем** таким мастерам и только **добавляет** строки OSC (`skipDuplicates`).
 * Удаление «лишних» OSC из БД не делает.
 *
 * Уже вызывается: создание личной услуги, удаление личной услуги, смена активного салона мастера.
 * **При появлении PATCH услуги** (смена `categoryId`, `isActive`, `organizationId`, soft-delete и т.д.) —
 * после успешной записи в той же транзакции вызывать с `activeOrganizationId` затронутого мастера
 * (и при смене салона — для старого и нового id, если нужно).
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
  if (rows.length === 0) {
    return;
  }
  await db.organizationServiceCategory.createMany({
    data: rows.map((r) => ({
      organizationId,
      serviceCategoryId: r.categoryId,
    })),
    skipDuplicates: true,
  });
}
