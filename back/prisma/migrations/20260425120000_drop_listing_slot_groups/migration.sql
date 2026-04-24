-- Свободные слоты витрины больше не храним; занятость — через брони.
ALTER TABLE "Organization" DROP COLUMN "listingSlotGroups";
ALTER TABLE "Specialist" DROP COLUMN "listingSlotGroups";
