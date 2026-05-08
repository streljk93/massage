-- Явный скоуп строки каталога услуг; инвариант с `organizationId` через CHECK.

CREATE TYPE "ServiceCatalogScope" AS ENUM ('personal', 'organization');

ALTER TABLE "Service" ADD COLUMN "scope" "ServiceCatalogScope";

UPDATE "Service" SET "scope" = 'personal' WHERE "organizationId" IS NULL;
UPDATE "Service" SET "scope" = 'organization' WHERE "organizationId" IS NOT NULL;

ALTER TABLE "Service" ALTER COLUMN "scope" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "scope" SET DEFAULT 'organization'::"ServiceCatalogScope";

ALTER TABLE "Service" ADD CONSTRAINT "Service_scope_organization_id_check" CHECK (
  ("scope" = 'personal'::"ServiceCatalogScope" AND "organizationId" IS NULL)
  OR
  ("scope" = 'organization'::"ServiceCatalogScope" AND "organizationId" IS NOT NULL)
);
