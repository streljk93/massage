-- Адрес работы / приёма для мастера (текст + город; гео остаётся в latitude/longitude).
ALTER TABLE "Specialist" ADD COLUMN "addressLine" TEXT;
ALTER TABLE "Specialist" ADD COLUMN "city" TEXT;

CREATE INDEX "Specialist_city_idx" ON "Specialist"("city");
