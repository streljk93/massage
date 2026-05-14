-- Разделяем UI-контекст activeOrganization и реальные места приёма мастера.

CREATE TABLE "SpecialistProfile" (
  "specialistId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "SpecialistProfile_pkey" PRIMARY KEY ("specialistId"),
  CONSTRAINT "SpecialistProfile_specialistId_fkey"
    FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SpecialistWorkplace" (
  "id" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "SpecialistWorkplace_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialistWorkplace_specialistId_fkey"
    FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpecialistWorkplace_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SpecialistWorkplace_specialistId_organizationId_key"
  ON "SpecialistWorkplace" ("specialistId", "organizationId");

CREATE INDEX "SpecialistWorkplace_specialistId_idx"
  ON "SpecialistWorkplace" ("specialistId");

CREATE INDEX "SpecialistWorkplace_organizationId_idx"
  ON "SpecialistWorkplace" ("organizationId");

CREATE INDEX "SpecialistWorkplace_isActive_idx"
  ON "SpecialistWorkplace" ("isActive");

CREATE UNIQUE INDEX "uniq_active_workplace_per_specialist"
  ON "SpecialistWorkplace" ("specialistId")
  WHERE "isActive" = true AND "deletedAt" IS NULL;

ALTER TABLE "SpecialistSearchProjection"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "hasActiveWorkplace" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "SpecialistSearchProjection_isActive_idx"
  ON "SpecialistSearchProjection" ("isActive");

CREATE INDEX "SpecialistSearchProjection_hasActiveWorkplace_idx"
  ON "SpecialistSearchProjection" ("hasActiveWorkplace");

ALTER TABLE "Booking"
  ADD COLUMN "workplaceId" TEXT;

CREATE INDEX "Booking_workplaceId_idx" ON "Booking" ("workplaceId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_workplaceId_fkey"
  FOREIGN KEY ("workplaceId") REFERENCES "SpecialistWorkplace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SpecialistProfile" ("specialistId", "isActive", "createdAt", "updatedAt")
SELECT s."id", true, NOW(), NOW()
FROM "Specialist" s
ON CONFLICT ("specialistId") DO NOTHING;

INSERT INTO "SpecialistWorkplace" (
  "id",
  "specialistId",
  "organizationId",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  s."id",
  s."activeOrganizationId",
  true,
  NOW(),
  NOW()
FROM "Specialist" s
WHERE s."activeOrganizationId" IS NOT NULL
ON CONFLICT ("specialistId", "organizationId") DO UPDATE
SET
  "isActive" = true,
  "deletedAt" = NULL,
  "updatedAt" = NOW();

INSERT INTO "SpecialistWorkplace" (
  "id",
  "specialistId",
  "organizationId",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e."specialistId",
  e."organizationId",
  false,
  NOW(),
  NOW()
FROM "SpecialistOrganizationEmployment" e
WHERE e."isActive" = true
ON CONFLICT ("specialistId", "organizationId") DO NOTHING;

UPDATE "SpecialistProfile" sp
SET "isActive" = false,
    "updatedAt" = NOW()
WHERE sp."specialistId" IN (
  SELECT s."id"
  FROM "Specialist" s
  WHERE s."listedInDirectory" = true
    AND NOT EXISTS (
      SELECT 1
      FROM "SpecialistWorkplace" w
      WHERE w."specialistId" = s."id"
        AND w."isActive" = true
        AND w."deletedAt" IS NULL
    )
);

UPDATE "Specialist" s
SET "listedInDirectory" = (
  s."onboardingCompletedAt" IS NOT NULL
  AND COALESCE(sp."isActive", false) = true
  AND EXISTS (
    SELECT 1
    FROM "SpecialistWorkplace" w
    WHERE w."specialistId" = s."id"
      AND w."isActive" = true
      AND w."deletedAt" IS NULL
  )
)
FROM "SpecialistProfile" sp
WHERE sp."specialistId" = s."id";

UPDATE "SpecialistSearchProjection" p
SET
  "isActive" = COALESCE(sp."isActive", false),
  "hasActiveWorkplace" = EXISTS (
    SELECT 1
    FROM "SpecialistWorkplace" w
    WHERE w."specialistId" = p."specialistId"
      AND w."isActive" = true
      AND w."deletedAt" IS NULL
  )
FROM "SpecialistProfile" sp
WHERE sp."specialistId" = p."specialistId";
