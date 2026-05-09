-- Маркетплейс Phase A: OrganizationOffering*, BookingSnapshot, outbox/поиск-проекция (ADR marketplace-offerings-search).

CREATE TYPE "OfferingPublicationStatus" AS ENUM (
  'draft',
  'pending_review',
  'published',
  'archived',
  'rejected',
  'hidden'
);

CREATE TYPE "OfferingPriceOptionStatus" AS ENUM ('active', 'hidden', 'archived');

CREATE TYPE "SpecialistOfferingStatus" AS ENUM ('active', 'paused', 'hidden', 'removed');

CREATE TYPE "TransactionalOutboxStatus" AS ENUM ('pending', 'dispatched', 'failed');

CREATE TABLE "BookingSnapshot" (
  "bookingId" TEXT NOT NULL,
  "organizationOfferingId" TEXT,
  "offeringPriceOptionId" TEXT,
  "serviceIdSnapshot" TEXT,
  "organizationOfferingTitleSnapshot" TEXT,
  "organizationNameSnapshot" TEXT,
  "specialistDisplayNameSnapshot" TEXT,
  "durationMinutesSnapshot" INTEGER NOT NULL,
  "priceAmountSnapshot" INTEGER,
  "currencySnapshot" TEXT DEFAULT 'VND',
  "addressLineSnapshot" TEXT,
  "citySnapshot" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingSnapshot_pkey" PRIMARY KEY ("bookingId")
);

CREATE TABLE "OrganizationOffering" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "publicationStatus" "OfferingPublicationStatus" NOT NULL DEFAULT 'draft',
  "firstPublishedAt" TIMESTAMP(3),
  "lastPublishedAt" TIMESTAMP(3),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferingPriceOption" (
  "id" TEXT NOT NULL,
  "organizationOfferingId" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "priceAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "OfferingPriceOptionStatus" NOT NULL DEFAULT 'active',
  "deletedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfferingPriceOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialistOffering" (
  "id" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "organizationOfferingId" TEXT NOT NULL,
  "status" "SpecialistOfferingStatus" NOT NULL DEFAULT 'active',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpecialistOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialistOfferingPriceOverride" (
  "id" TEXT NOT NULL,
  "specialistOfferingId" TEXT NOT NULL,
  "offeringPriceOptionId" TEXT NOT NULL,
  "customPrice" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpecialistOfferingPriceOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchDocumentProjection" (
  "organizationOfferingId" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "document" JSONB NOT NULL,
  "projectionBuildVersion" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchDocumentProjection_pkey" PRIMARY KEY ("organizationOfferingId")
);

CREATE TABLE "TransactionalOutboxEntry" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "dedupeKey" TEXT,
  "status" "TransactionalOutboxStatus" NOT NULL DEFAULT 'pending',
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  CONSTRAINT "TransactionalOutboxEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingSnapshot"
  ADD CONSTRAINT "BookingSnapshot_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationOffering"
  ADD CONSTRAINT "OrganizationOffering_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationOffering"
  ADD CONSTRAINT "OrganizationOffering_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfferingPriceOption"
  ADD CONSTRAINT "OfferingPriceOption_organizationOfferingId_fkey"
  FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialistOffering"
  ADD CONSTRAINT "SpecialistOffering_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialistOffering"
  ADD CONSTRAINT "SpecialistOffering_organizationOfferingId_fkey"
  FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialistOfferingPriceOverride"
  ADD CONSTRAINT "SpecialistOfferingPriceOverride_specialistOfferingId_fkey"
  FOREIGN KEY ("specialistOfferingId") REFERENCES "SpecialistOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialistOfferingPriceOverride"
  ADD CONSTRAINT "SpecialistOfferingPriceOverride_offeringPriceOptionId_fkey"
  FOREIGN KEY ("offeringPriceOptionId") REFERENCES "OfferingPriceOption" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OrganizationOffering_org_slug_active_key"
  ON "OrganizationOffering" ("organizationId", "slug")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "OrganizationOffering_organizationId_idx" ON "OrganizationOffering" ("organizationId");

CREATE UNIQUE INDEX "OfferingPriceOption_offering_duration_active_key"
  ON "OfferingPriceOption" ("organizationOfferingId", "durationMinutes")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "OfferingPriceOption_organizationOfferingId_idx" ON "OfferingPriceOption" ("organizationOfferingId");

CREATE UNIQUE INDEX "SpecialistOffering_specialistId_organizationOfferingId_key"
  ON "SpecialistOffering" ("specialistId", "organizationOfferingId");

CREATE INDEX "SpecialistOffering_organizationOfferingId_idx" ON "SpecialistOffering" ("organizationOfferingId");

CREATE UNIQUE INDEX "SpecialistOfferingPriceOverride_specialistOfferingId_offeringPriceOptionId_key"
  ON "SpecialistOfferingPriceOverride" ("specialistOfferingId", "offeringPriceOptionId");

CREATE INDEX "SpecialistOfferingPriceOverride_offeringPriceOptionId_idx"
  ON "SpecialistOfferingPriceOverride" ("offeringPriceOptionId");

CREATE UNIQUE INDEX "TransactionalOutboxEntry_dedupeKey_key" ON "TransactionalOutboxEntry" ("dedupeKey");

CREATE INDEX "TransactionalOutboxEntry_status_createdAt_idx" ON "TransactionalOutboxEntry" ("status", "createdAt");

CREATE INDEX "TransactionalOutboxEntry_aggregateType_aggregateId_idx"
  ON "TransactionalOutboxEntry" ("aggregateType", "aggregateId");
