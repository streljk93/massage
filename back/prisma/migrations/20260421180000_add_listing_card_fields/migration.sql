-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "listingMetaLine" TEXT,
ADD COLUMN     "listingServicesLine" TEXT,
ADD COLUMN     "listingSlotGroups" JSONB;

-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN     "listingMetaLine" TEXT,
ADD COLUMN     "listingServicesLine" TEXT,
ADD COLUMN     "listingSlotGroups" JSONB;
