-- Pending, созданные со старым окном (120 мин), пересчитываем: createdAt + grace организации (по умолчанию 15 мин).
-- Новые записи уже получают корректный pendingExpiresAt из BookingsService.

UPDATE "Booking" b
SET "pendingExpiresAt" = b."createdAt" + (COALESCE(o."bookingConfirmationGraceMinutes", 15) * INTERVAL '1 minute')
FROM "Organization" o
WHERE b."organizationId" = o."id"
  AND b."status" = 'pending'
  AND b."deletedAt" IS NULL;

UPDATE "Booking" b
SET "pendingExpiresAt" = b."createdAt" + (15 * INTERVAL '1 minute')
WHERE b."organizationId" IS NULL
  AND b."status" = 'pending'
  AND b."deletedAt" IS NULL;
