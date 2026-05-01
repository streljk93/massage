-- Единый снимок черновика (ручной ввод) на ревизии + категории; таблица локалей ревизии удалена.

CREATE TABLE "OrganizationProfileRevisionServiceCategory" (
    "revisionId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,

    CONSTRAINT "OrganizationProfileRevisionServiceCategory_pkey" PRIMARY KEY ("revisionId","serviceCategoryId")
);

ALTER TABLE "OrganizationProfileRevisionServiceCategory"
  ADD CONSTRAINT "OrganizationProfileRevisionServiceCategory_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "OrganizationProfileRevision"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationProfileRevisionServiceCategory"
  ADD CONSTRAINT "OrganizationProfileRevisionServiceCategory_serviceCategoryId_fkey"
    FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OrganizationProfileRevisionServiceCategory_serviceCategoryId_idx"
  ON "OrganizationProfileRevisionServiceCategory"("serviceCategoryId");

ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "catalogLocale" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "phone" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "email" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "website" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "yearsInBusiness" INTEGER;

ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "addressLine" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "city" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "addressSourceProvider" TEXT;
ALTER TABLE "OrganizationProfileRevision" ADD COLUMN "addressSourceReference" TEXT;

UPDATE "OrganizationProfileRevision" AS r
SET "catalogLocale" = COALESCE(
  (
    SELECT rl.locale
    FROM "OrganizationProfileRevisionLocale" AS rl
    WHERE rl."revisionId" = r.id
    ORDER BY rl.locale ASC
    LIMIT 1
  ),
  'vi'
)
WHERE r."catalogLocale" IS NULL;

UPDATE "OrganizationProfileRevision" AS r
SET
  phone = o.phone,
  email = o.email,
  website = o.website,
  "yearsInBusiness" = o."yearsInBusiness",
  "addressLine" = a."addressLine",
  city = a.city,
  latitude = a.latitude,
  longitude = a.longitude,
  "addressSourceProvider" = a."sourceProvider",
  "addressSourceReference" = a."sourceReference"
FROM "Organization" AS o
LEFT JOIN "Address" AS a ON o."addressId" = a.id
WHERE r."organizationId" = o.id;

ALTER TABLE "OrganizationProfileRevision"
  ALTER COLUMN "catalogLocale" SET NOT NULL;

INSERT INTO "OrganizationProfileRevisionServiceCategory" ("revisionId", "serviceCategoryId")
SELECT r.id, osc."serviceCategoryId"
FROM "OrganizationProfileRevision" AS r
INNER JOIN "OrganizationServiceCategory" AS osc ON osc."organizationId" = r."organizationId"
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS "OrganizationProfileRevisionLocale";
