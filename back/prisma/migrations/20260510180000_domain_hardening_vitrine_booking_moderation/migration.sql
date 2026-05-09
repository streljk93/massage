-- Домен: витрина мастера без legacy catalogListed*; версия снимка брони; метаданные истории статусов; очередь модерации.

ALTER TABLE "Specialist" DROP COLUMN IF EXISTS "catalogListedBio";
ALTER TABLE "Specialist" DROP COLUMN IF EXISTS "catalogListedListingName";
ALTER TABLE "Specialist" DROP COLUMN IF EXISTS "catalogListedImageUrl";

ALTER TABLE "BookingSnapshot" ADD COLUMN "snapshotSchemaVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "BookingStatusHistory" ADD COLUMN "transitionKind" TEXT;
ALTER TABLE "BookingStatusHistory" ADD COLUMN "reasonCode" TEXT;
ALTER TABLE "BookingStatusHistory" ADD COLUMN "actorKind" TEXT;

CREATE INDEX "BookingStatusHistory_reasonCode_idx" ON "BookingStatusHistory"("reasonCode");

ALTER TABLE "ContentModerationCase" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "ContentModerationCase" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentModerationCase" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentModerationCase" ADD COLUMN "lastProcessedAt" TIMESTAMP(3);
ALTER TABLE "ContentModerationCase" ADD COLUMN "lockedByUserId" TEXT;
ALTER TABLE "ContentModerationCase" ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE INDEX "ContentModerationCase_assignedToUserId_idx" ON "ContentModerationCase"("assignedToUserId");
CREATE INDEX "ContentModerationCase_lockedByUserId_idx" ON "ContentModerationCase"("lockedByUserId");

ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
