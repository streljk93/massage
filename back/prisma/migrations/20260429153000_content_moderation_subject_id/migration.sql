-- Полиморфная привязка кейсов модерации: одна пара (kind + subjectId) вместо независимых FK-колонок.

ALTER TABLE "ContentModerationCase" ADD COLUMN "subjectId" TEXT;

UPDATE "ContentModerationCase"
SET "subjectId" = COALESCE(
        "organizationId",
        "organizationReviewId",
        "specialistReviewId",
        "targetUserId"
    )
WHERE TRUE;

ALTER TABLE "ContentModerationCase" DROP CONSTRAINT "ContentModerationCase_organizationId_fkey";
ALTER TABLE "ContentModerationCase" DROP CONSTRAINT "ContentModerationCase_organizationReviewId_fkey";
ALTER TABLE "ContentModerationCase" DROP CONSTRAINT "ContentModerationCase_specialistReviewId_fkey";
ALTER TABLE "ContentModerationCase" DROP CONSTRAINT "ContentModerationCase_targetUserId_fkey";

DROP INDEX IF EXISTS "ContentModerationCase_organizationReviewId_key";
DROP INDEX IF EXISTS "ContentModerationCase_specialistReviewId_key";
DROP INDEX IF EXISTS "ContentModerationCase_organizationId_idx";
DROP INDEX IF EXISTS "ContentModerationCase_targetUserId_idx";

ALTER TABLE "ContentModerationCase"
    DROP COLUMN "organizationId",
    DROP COLUMN "organizationReviewId",
    DROP COLUMN "specialistReviewId",
    DROP COLUMN "targetUserId";

ALTER TABLE "ContentModerationCase" ALTER COLUMN "subjectId" SET NOT NULL;

CREATE UNIQUE INDEX "ContentModerationCase_kind_subjectId_key" ON "ContentModerationCase"("kind", "subjectId");
