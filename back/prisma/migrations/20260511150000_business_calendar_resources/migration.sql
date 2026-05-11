-- Business calendar: CalendarEvent is the source of truth for resource occupancy.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "CalendarResourceType" AS ENUM ('specialist', 'room', 'equipment');
CREATE TYPE "CalendarEventType" AS ENUM ('booking', 'block');
CREATE TYPE "CalendarBlockReason" AS ENUM ('break', 'vacation', 'manual');
CREATE TYPE "CalendarEventStatus" AS ENUM ('pending', 'confirmed', 'in_progress', 'cancelled');
CREATE TYPE "AvailabilityRuleType" AS ENUM ('working', 'break');
CREATE TYPE "AvailabilityOverrideType" AS ENUM ('off', 'extra');

-- Organization timezone for wall-clock availability rules.
ALTER TABLE "Organization"
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

-- Calendar resources.
CREATE TABLE "CalendarResource" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "CalendarResourceType" NOT NULL,
  "specialistId" TEXT,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CalendarResource_pkey" PRIMARY KEY ("id")
);

-- Calendar events.
CREATE TABLE "CalendarEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "bookingId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "type" "CalendarEventType" NOT NULL,
  "status" "CalendarEventStatus" NOT NULL,
  "blockReason" "CalendarBlockReason",
  "createdByUserId" TEXT,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- Event/resource binding.
CREATE TABLE "CalendarEventResource" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "role" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarEventResource_pkey" PRIMARY KEY ("id")
);

-- Weekly availability in organization timezone.
CREATE TABLE "AvailabilityRule" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "type" "AvailabilityRuleType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- Date-specific availability overrides in organization timezone.
CREATE TABLE "AvailabilityOverride" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "type" "AvailabilityOverrideType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- Audit only for service block events; BookingEvent remains booking lifecycle audit.
CREATE TABLE "CalendarEventAudit" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarEventAudit_pkey" PRIMARY KEY ("id")
);

-- Booking points to the calendar source-of-truth event.
ALTER TABLE "Booking" ADD COLUMN "calendarEventId" TEXT;

-- The old Booking exclusion constraint is no longer the source of truth for occupancy.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_active_slot_excl";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "activeSlotRange";

-- Indexes.
CREATE INDEX "CalendarResource_organizationId_type_isActive_deletedAt_idx"
  ON "CalendarResource"("organizationId", "type", "isActive", "deletedAt");
CREATE INDEX "CalendarResource_specialistId_idx"
  ON "CalendarResource"("specialistId");

CREATE INDEX "CalendarEvent_organizationId_startsAt_endsAt_idx"
  ON "CalendarEvent"("organizationId", "startsAt", "endsAt");
CREATE INDEX "CalendarEvent_startsAt_endsAt_status_deletedAt_idx"
  ON "CalendarEvent"("startsAt", "endsAt", "status", "deletedAt");
CREATE INDEX "CalendarEvent_bookingId_idx"
  ON "CalendarEvent"("bookingId");

CREATE UNIQUE INDEX "CalendarEventResource_eventId_resourceId_key"
  ON "CalendarEventResource"("eventId", "resourceId");
CREATE INDEX "CalendarEventResource_resourceId_idx"
  ON "CalendarEventResource"("resourceId");
CREATE INDEX "CalendarEventResource_resourceId_eventId_idx"
  ON "CalendarEventResource"("resourceId", "eventId");

CREATE INDEX "AvailabilityRule_resourceId_weekday_type_deletedAt_idx"
  ON "AvailabilityRule"("resourceId", "weekday", "type", "deletedAt");
CREATE INDEX "AvailabilityOverride_resourceId_date_type_deletedAt_idx"
  ON "AvailabilityOverride"("resourceId", "date", "type", "deletedAt");
CREATE INDEX "CalendarEventAudit_eventId_createdAt_idx"
  ON "CalendarEventAudit"("eventId", "createdAt");
CREATE INDEX "CalendarEventAudit_actorUserId_idx"
  ON "CalendarEventAudit"("actorUserId");
CREATE UNIQUE INDEX "Booking_calendarEventId_key"
  ON "Booking"("calendarEventId");

-- Foreign keys.
ALTER TABLE "CalendarResource"
  ADD CONSTRAINT "CalendarResource_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarResource"
  ADD CONSTRAINT "CalendarResource_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEventResource"
  ADD CONSTRAINT "CalendarEventResource_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventResource"
  ADD CONSTRAINT "CalendarEventResource_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "CalendarResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT "AvailabilityRule_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "CalendarResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityOverride"
  ADD CONSTRAINT "AvailabilityOverride_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "CalendarResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEventAudit"
  ADD CONSTRAINT "CalendarEventAudit_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventAudit"
  ADD CONSTRAINT "CalendarEventAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill specialist resources for active contexts and legacy bookings.
WITH specialist_org_pairs AS (
  SELECT DISTINCT e."specialistId", e."organizationId"
  FROM "SpecialistOrganizationEmployment" e
  WHERE e."isActive" = true
  UNION
  SELECT DISTINCT s."id" AS "specialistId", s."activeOrganizationId" AS "organizationId"
  FROM "Specialist" s
  WHERE s."activeOrganizationId" IS NOT NULL
  UNION
  SELECT DISTINCT b."specialistId", b."organizationId"
  FROM "Booking" b
  WHERE b."organizationId" IS NOT NULL
)
INSERT INTO "CalendarResource" (
  "id",
  "organizationId",
  "type",
  "specialistId",
  "name",
  "capacity",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."organizationId",
  'specialist'::"CalendarResourceType",
  p."specialistId",
  COALESCE(NULLIF(TRIM(s."listingName"), ''), NULLIF(TRIM(u."name"), ''), 'Specialist'),
  1,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM specialist_org_pairs p
INNER JOIN "Specialist" s ON s."id" = p."specialistId"
INNER JOIN "User" u ON u."id" = s."userId"
WHERE p."organizationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CalendarResource" r
    WHERE r."organizationId" = p."organizationId"
      AND r."specialistId" = p."specialistId"
      AND r."type" = 'specialist'::"CalendarResourceType"
      AND r."deletedAt" IS NULL
  );

-- Default weekly working rules mirror organization listing workday for bootstrapped specialist resources.
INSERT INTO "AvailabilityRule" (
  "id",
  "resourceId",
  "weekday",
  "startMinute",
  "endMinute",
  "type",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  r."id",
  wd."weekday",
  o."listingWorkdayStartMinute",
  o."listingWorkdayEndMinute",
  'working'::"AvailabilityRuleType",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CalendarResource" r
INNER JOIN "Organization" o ON o."id" = r."organizationId"
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS wd("weekday")
WHERE r."type" = 'specialist'::"CalendarResourceType"
  AND r."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "AvailabilityRule" ar
    WHERE ar."resourceId" = r."id"
      AND ar."weekday" = wd."weekday"
      AND ar."type" = 'working'::"AvailabilityRuleType"
      AND ar."deletedAt" IS NULL
  );

CREATE TEMP TABLE "_booking_calendar_backfill" (
  "bookingId" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_booking_calendar_backfill" ("bookingId", "eventId", "organizationId", "resourceId")
SELECT
  b."id",
  gen_random_uuid()::text,
  resolved."organizationId",
  r."id"
FROM "Booking" b
INNER JOIN "Specialist" s ON s."id" = b."specialistId"
CROSS JOIN LATERAL (
  SELECT COALESCE(
    b."organizationId",
    s."activeOrganizationId",
    (
      SELECT e."organizationId"
      FROM "SpecialistOrganizationEmployment" e
      WHERE e."specialistId" = b."specialistId"
        AND e."isActive" = true
      ORDER BY e."createdAt" DESC, e."id" DESC
      LIMIT 1
    )
  ) AS "organizationId"
) resolved
INNER JOIN "CalendarResource" r
  ON r."organizationId" = resolved."organizationId"
 AND r."specialistId" = b."specialistId"
 AND r."type" = 'specialist'::"CalendarResourceType"
 AND r."deletedAt" IS NULL
WHERE b."calendarEventId" IS NULL
  AND resolved."organizationId" IS NOT NULL;

INSERT INTO "CalendarEvent" (
  "id",
  "organizationId",
  "bookingId",
  "startsAt",
  "endsAt",
  "type",
  "status",
  "createdByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  bf."eventId",
  bf."organizationId",
  b."id",
  b."startsAt",
  b."endsAt",
  'booking'::"CalendarEventType",
  CASE
    WHEN b."status" = 'pending'::"BookingStatus" THEN 'pending'::"CalendarEventStatus"
    WHEN b."status" = 'confirmed'::"BookingStatus" THEN 'confirmed'::"CalendarEventStatus"
    WHEN b."status" = 'in_progress'::"BookingStatus" THEN 'in_progress'::"CalendarEventStatus"
    ELSE 'cancelled'::"CalendarEventStatus"
  END,
  b."clientUserId",
  b."createdAt",
  CURRENT_TIMESTAMP
FROM "_booking_calendar_backfill" bf
INNER JOIN "Booking" b ON b."id" = bf."bookingId";

INSERT INTO "CalendarEventResource" (
  "id",
  "eventId",
  "resourceId",
  "role",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  bf."eventId",
  bf."resourceId",
  'specialist',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_booking_calendar_backfill" bf;

UPDATE "Booking" b
SET "calendarEventId" = bf."eventId"
FROM "_booking_calendar_backfill" bf
WHERE b."id" = bf."bookingId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" WHERE "calendarEventId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot add Booking.calendarEventId NOT NULL: some legacy bookings have no organization context';
  END IF;
END $$;

ALTER TABLE "Booking" ALTER COLUMN "calendarEventId" SET NOT NULL;
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_calendarEventId_fkey"
  FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
