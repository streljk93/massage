-- Единственный живой контур записи через офферы; строки `Service` только как личный каталог мастера (`specialistId` обязателен).
-- Салонные строки каталога и столбцы скоупа удаляются (ожидается migrate reset или чистые данные).

DELETE FROM "Service"
WHERE "organizationId" IS NOT NULL
   OR "specialistId" IS NULL;

ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_scope_organization_id_check";

ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_organizationId_fkey";

DROP INDEX IF EXISTS "Service_organizationId_slug_idx";
DROP INDEX IF EXISTS "Service_specialistId_slug_idx";

ALTER TABLE "Service" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "scope";

ALTER TABLE "Service" ALTER COLUMN "specialistId" SET NOT NULL;

ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_specialistId_fkey";
ALTER TABLE "Service"
  ADD CONSTRAINT "Service_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Service_specialistId_slug_key" ON "Service"("specialistId", "slug");

DROP TYPE IF EXISTS "ServiceCatalogScope";
