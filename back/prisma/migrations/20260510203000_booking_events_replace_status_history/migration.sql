-- Поток доменных событий бронирования; журнал переходов вынесен из BookingStatusHistory.

CREATE TYPE "BookingEventType" AS ENUM ('created', 'confirmed', 'rejected', 'canceled', 'no_show', 'completed', 'started', 'expired', 'rescheduled');

CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "BookingEventType" NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");
CREATE INDEX "BookingEvent_bookingId_id_idx" ON "BookingEvent"("bookingId", "id");
CREATE INDEX "BookingEvent_type_idx" ON "BookingEvent"("type");

ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "BookingEvent" ("id", "bookingId", "type", "actorKind", "actorUserId", "payload", "createdAt")
SELECT
  gen_random_uuid()::text,
  h."bookingId",
  CASE
    WHEN h."fromStatus" IS NULL AND h."toStatus" = 'pending' THEN 'created'::"BookingEventType"
    WHEN h."fromStatus" = 'pending' AND h."toStatus" = 'confirmed' THEN 'confirmed'::"BookingEventType"
    WHEN h."fromStatus" = 'pending' AND h."toStatus" = 'expired' THEN 'expired'::"BookingEventType"
    WHEN h."fromStatus" = 'pending' AND h."toStatus" = 'reject_by_master' THEN 'rejected'::"BookingEventType"
    WHEN h."fromStatus" = 'pending' AND h."toStatus" = 'reject_by_client' THEN 'rejected'::"BookingEventType"
    WHEN h."fromStatus" = 'confirmed' AND h."toStatus" = 'in_progress' THEN 'started'::"BookingEventType"
    WHEN h."fromStatus" IN ('confirmed', 'pending') AND h."toStatus" = 'no_show_by_client' THEN 'no_show'::"BookingEventType"
    WHEN h."fromStatus" IN ('confirmed', 'pending') AND h."toStatus" = 'no_show_by_master' THEN 'no_show'::"BookingEventType"
    WHEN h."fromStatus" IN ('confirmed', 'in_progress')
      AND h."toStatus" IN ('canceled_by_master', 'canceled_by_client') THEN 'canceled'::"BookingEventType"
    WHEN h."fromStatus" = 'in_progress' AND h."toStatus" = 'done' THEN 'completed'::"BookingEventType"
    WHEN h."fromStatus" IN ('confirmed', 'in_progress')
      AND h."toStatus" IN ('reject_by_master', 'reject_by_client') THEN 'rejected'::"BookingEventType"
    ELSE 'canceled'::"BookingEventType"
  END AS "type",
  COALESCE(NULLIF(trim(h."actorKind"), ''), 'system') AS "actorKind",
  h."actorUserId",
  CASE
    WHEN h."fromStatus" IS NULL AND h."toStatus" = 'pending' THEN
      jsonb_strip_nulls(jsonb_build_object(
        'startsAt', to_jsonb(b."startsAt"),
        'endsAt', to_jsonb(b."endsAt"),
        'pendingExpiresAt',
        CASE WHEN b."pendingExpiresAt" IS NULL THEN NULL ELSE to_jsonb(b."pendingExpiresAt") END
      ))
    WHEN h."toStatus" IN ('reject_by_master', 'reject_by_client') THEN jsonb_build_object(
      'rejectParty',
      CASE WHEN h."toStatus" = 'reject_by_master' THEN 'specialist'::text ELSE 'client'::text END)
    WHEN h."toStatus" IN ('expired') THEN jsonb_strip_nulls(
      jsonb_build_object(
        'reasonCode',
        COALESCE(NULLIF(trim(h."reasonCode"), ''), 'pending_confirmation_timeout'::text),
        'reasonText',
        h."reason"))
    WHEN h."toStatus" IN ('no_show_by_client', 'no_show_by_master') THEN jsonb_build_object(
      'party',
      CASE WHEN h."toStatus" = 'no_show_by_client' THEN 'client'::text ELSE 'specialist'::text END)
    WHEN h."toStatus" IN ('canceled_by_master', 'canceled_by_client') THEN jsonb_strip_nulls(
      jsonb_build_object(
        'cancelParty',
        CASE WHEN h."toStatus" = 'canceled_by_master' THEN 'specialist'::text ELSE 'client'::text END,
        'massOrganizationAction',
        CASE WHEN h."transitionKind" = 'mass_organization_action' THEN true ELSE NULL END,
        'reasonCode',
        h."reasonCode",
        'cancellationComment',
        CASE
          WHEN b."cancellationComment" IS NOT NULL AND trim(b."cancellationComment") <> '' THEN b."cancellationComment"
          ELSE NULL
        END,
        'reasonText',
        h."reason"))
    WHEN h."toStatus" IN ('done') THEN jsonb_strip_nulls(
      jsonb_build_object(
        'reasonCode',
        h."reasonCode",
        'reasonText',
        h."reason"))
    WHEN h."fromStatus" = 'pending' AND h."toStatus" = 'confirmed' THEN '{}'::jsonb
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'devOrUnknownTransition', true,
      'fromStatus', CASE WHEN h."fromStatus" IS NULL THEN NULL ELSE to_jsonb(h."fromStatus"::text) END,
      'toStatus', to_jsonb(h."toStatus"::text),
      'reasonCode', h."reasonCode",
      'reasonText', h."reason",
      'transitionKind', h."transitionKind"))
  END AS "payload",
  h."createdAt"
FROM "BookingStatusHistory" h
JOIN "Booking" b ON b.id = h."bookingId";

INSERT INTO "BookingEvent" ("id", "bookingId", "type", "actorKind", "actorUserId", "payload", "createdAt")
SELECT
  gen_random_uuid()::text,
  b.id,
  'created'::"BookingEventType",
  'system',
  NULL,
  jsonb_strip_nulls(
    jsonb_build_object(
      'startsAt', to_jsonb(b."startsAt"),
      'endsAt', to_jsonb(b."endsAt"),
      'pendingExpiresAt',
      CASE WHEN b."pendingExpiresAt" IS NULL THEN NULL ELSE to_jsonb(b."pendingExpiresAt") END,
      'legacyMissingHistory', true)),
  b."createdAt"
FROM "Booking" b
WHERE NOT EXISTS (SELECT 1 FROM "BookingEvent" e WHERE e."bookingId" = b.id);

DROP TABLE "BookingStatusHistory";
