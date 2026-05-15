-- Локализация и massage-specific зоны для коммерческих офферов организации.

CREATE TABLE "OrganizationOfferingLocale" (
  "id" TEXT NOT NULL,
  "organizationOfferingId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationOfferingLocale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationOfferingBodyZone" (
  "organizationOfferingId" TEXT NOT NULL,
  "bodyZoneId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationOfferingBodyZone_pkey" PRIMARY KEY ("organizationOfferingId", "bodyZoneId")
);

ALTER TABLE "OrganizationOfferingLocale"
  ADD CONSTRAINT "OrganizationOfferingLocale_organizationOfferingId_fkey"
  FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationOfferingBodyZone"
  ADD CONSTRAINT "OrganizationOfferingBodyZone_organizationOfferingId_fkey"
  FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationOfferingBodyZone"
  ADD CONSTRAINT "OrganizationOfferingBodyZone_bodyZoneId_fkey"
  FOREIGN KEY ("bodyZoneId") REFERENCES "BodyZone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OrganizationOfferingLocale_organizationOfferingId_locale_key"
  ON "OrganizationOfferingLocale" ("organizationOfferingId", "locale");

CREATE INDEX "OrganizationOfferingLocale_locale_idx"
  ON "OrganizationOfferingLocale" ("locale");

CREATE INDEX "OrganizationOfferingBodyZone_bodyZoneId_idx"
  ON "OrganizationOfferingBodyZone" ("bodyZoneId");
