-- Колонки якоря брони на оффер точки. Применять **после** `20260510123000_marketplace_*` —
-- FK ссылается на `OrganizationOffering` и `OfferingPriceOption`.
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "organizationOfferingId" TEXT,
  ADD COLUMN IF NOT EXISTS "offeringPriceOptionId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_organizationOfferingId_fkey'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_organizationOfferingId_fkey"
      FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_offeringPriceOptionId_fkey'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_offeringPriceOptionId_fkey"
      FOREIGN KEY ("offeringPriceOptionId") REFERENCES "OfferingPriceOption"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Booking_organizationOfferingId_idx"
  ON "Booking"("organizationOfferingId");
CREATE INDEX IF NOT EXISTS "Booking_offeringPriceOptionId_idx"
  ON "Booking"("offeringPriceOptionId");
