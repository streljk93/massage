-- Бронирование только по marketplace: удаляем legacy `serviceId` у `Booking` и снимок в `BookingSnapshot`.
-- Приложение без прода: перед NOT NULL очищаем все брони (снимки и история статусов — CASCADE).

DELETE FROM "Booking";

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_serviceId_fkey";

ALTER TABLE "Booking" DROP COLUMN IF EXISTS "serviceId";

ALTER TABLE "BookingSnapshot" DROP COLUMN IF EXISTS "serviceIdSnapshot";

ALTER TABLE "Booking" ALTER COLUMN "organizationOfferingId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "offeringPriceOptionId" SET NOT NULL;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_organizationOfferingId_fkey";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_organizationOfferingId_fkey"
  FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_offeringPriceOptionId_fkey";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_offeringPriceOptionId_fkey"
  FOREIGN KEY ("offeringPriceOptionId") REFERENCES "OfferingPriceOption"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingSnapshot" ALTER COLUMN "organizationOfferingId" SET NOT NULL;
ALTER TABLE "BookingSnapshot" ALTER COLUMN "offeringPriceOptionId" SET NOT NULL;
