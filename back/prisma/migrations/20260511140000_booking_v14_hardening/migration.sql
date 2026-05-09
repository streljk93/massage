-- Booking domain v14: журнал localSequence, BookingActorKind, optimistic version / projectionHash,
-- идемпотентность создания и append, SpecialistTimeOff, EXCLUDE (btree_gist) по активному слоту мастера.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "BookingActorKind" AS ENUM ('client', 'specialist', 'staff', 'system');

-- AlterTable Booking
ALTER TABLE "Booking" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "lastAppliedSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "projectionHash" TEXT;

-- Сгенерированный диапазон: `Booking.startsAt`/`endsAt` — TIMESTAMP(3) без TZ в Prisma → `tsrange`; Prisma колонку не моделирует.
ALTER TABLE "Booking" ADD COLUMN "activeSlotRange" tsrange
  GENERATED ALWAYS AS (
    CASE
      WHEN "deletedAt" IS NULL AND (
        "status" = 'pending'::"BookingStatus"
        OR "status" = 'confirmed'::"BookingStatus"
        OR "status" = 'in_progress'::"BookingStatus"
      )
      THEN tsrange("startsAt", "endsAt", '[)')
      ELSE tsrange("startsAt", "startsAt", '[)')
    END
  ) STORED;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_active_slot_excl"
  EXCLUDE USING gist ("specialistId" WITH =, "activeSlotRange" WITH &&);

-- AlterTable BookingSnapshot
ALTER TABLE "BookingSnapshot" ADD COLUMN "snapshotHash" TEXT;

-- CreateTable SpecialistTimeOff
CREATE TABLE "SpecialistTimeOff" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistTimeOff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpecialistTimeOff_specialistId_startsAt_idx" ON "SpecialistTimeOff"("specialistId", "startsAt");
CREATE INDEX "SpecialistTimeOff_specialistId_endsAt_idx" ON "SpecialistTimeOff"("specialistId", "endsAt");
ALTER TABLE "SpecialistTimeOff" ADD CONSTRAINT "SpecialistTimeOff_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ClientBookingCreateIdempotency
CREATE TABLE "ClientBookingCreateIdempotency" (
    "clientUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientBookingCreateIdempotency_pkey" PRIMARY KEY ("clientUserId","idempotencyKey")
);

CREATE UNIQUE INDEX "ClientBookingCreateIdempotency_bookingId_key" ON "ClientBookingCreateIdempotency"("bookingId");
CREATE INDEX "ClientBookingCreateIdempotency_bookingId_idx" ON "ClientBookingCreateIdempotency"("bookingId");
ALTER TABLE "ClientBookingCreateIdempotency" ADD CONSTRAINT "ClientBookingCreateIdempotency_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable BookingEvent — поэтапно, чтобы не терять данные
ALTER TABLE "BookingEvent" ADD COLUMN "localSequence" INTEGER;
ALTER TABLE "BookingEvent" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "BookingEvent" ADD COLUMN "actorKind_new" "BookingActorKind";

UPDATE "BookingEvent"
SET "actorKind_new" = CASE LOWER(TRIM("actorKind"))
  WHEN 'client' THEN 'client'::"BookingActorKind"
  WHEN 'specialist' THEN 'specialist'::"BookingActorKind"
  WHEN 'staff' THEN 'staff'::"BookingActorKind"
  WHEN 'system' THEN 'system'::"BookingActorKind"
  ELSE 'staff'::"BookingActorKind"
END;

ALTER TABLE "BookingEvent" DROP COLUMN "actorKind";
ALTER TABLE "BookingEvent" RENAME COLUMN "actorKind_new" TO "actorKind";
ALTER TABLE "BookingEvent" ALTER COLUMN "actorKind" SET NOT NULL;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "bookingId" ORDER BY "createdAt" ASC, id ASC) AS seq
  FROM "BookingEvent"
)
UPDATE "BookingEvent" e
SET "localSequence" = o.seq
FROM ordered o
WHERE e.id = o.id;

ALTER TABLE "BookingEvent" ALTER COLUMN "localSequence" SET NOT NULL;

UPDATE "Booking" b
SET "lastAppliedSequence" = COALESCE((
  SELECT MAX("localSequence") FROM "BookingEvent" e WHERE e."bookingId" = b.id
), 0);

CREATE UNIQUE INDEX "BookingEvent_bookingId_idempotencyKey_key" ON "BookingEvent"("bookingId", "idempotencyKey");
CREATE INDEX "BookingEvent_bookingId_localSequence_idx" ON "BookingEvent"("bookingId", "localSequence");
