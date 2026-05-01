-- Ревизии профиля организации + развод комментариев отзывов + catalogListedName.
-- После этого `organization_profile` в ContentModerationCase.subjectId = OrganizationProfileRevision.id.

-- 1. Enum статусов ревизии
CREATE TYPE "OrganizationProfileRevisionStatus" AS ENUM (
    'pending_review',
    'published',
    'rejected',
    'superseded'
);

-- 2. Расширяем GalleryOwnerKind
ALTER TYPE "GalleryOwnerKind" ADD VALUE IF NOT EXISTS 'organization_profile_revision';

-- 3. Таблицы ревизий
CREATE TABLE "OrganizationProfileRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "OrganizationProfileRevisionStatus" NOT NULL DEFAULT 'pending_review',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationProfileRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationProfileRevisionLocale" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationProfileRevisionLocale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationProfileRevisionLocale_revisionId_locale_key"
    ON "OrganizationProfileRevisionLocale"("revisionId", "locale");
CREATE INDEX "OrganizationProfileRevisionLocale_locale_idx"
    ON "OrganizationProfileRevisionLocale"("locale");
CREATE INDEX "OrganizationProfileRevision_organizationId_idx"
    ON "OrganizationProfileRevision"("organizationId");
CREATE INDEX "OrganizationProfileRevision_organizationId_status_idx"
    ON "OrganizationProfileRevision"("organizationId", "status");

ALTER TABLE "OrganizationProfileRevision"
    ADD CONSTRAINT "OrganizationProfileRevision_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationProfileRevisionLocale"
    ADD CONSTRAINT "OrganizationProfileRevisionLocale_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "OrganizationProfileRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Organization.publishedProfileRevisionId (FK после backfill ниже)
ALTER TABLE "Organization" ADD COLUMN "publishedProfileRevisionId" TEXT UNIQUE;

ALTER TABLE "User" ADD COLUMN "catalogListedName" TEXT;

-- 5. Отзывы: новые столбцы, перенос
ALTER TABLE "OrganizationReview" ADD COLUMN "publishedComment" TEXT;
ALTER TABLE "OrganizationReview" ADD COLUMN "pendingCommentDraft" TEXT;

UPDATE "OrganizationReview"
SET "publishedComment" = "comment",
    "pendingCommentDraft" = NULL
WHERE "publicationModerationStatus" = 'approved'
  AND "comment" IS NOT NULL
  AND length(trim("comment")) > 0;

UPDATE "OrganizationReview"
SET "publishedComment" = NULL,
    "pendingCommentDraft" = "comment"
WHERE "publicationModerationStatus" <> 'approved'
  AND "comment" IS NOT NULL
  AND length(trim("comment")) > 0;

ALTER TABLE "OrganizationReview" DROP COLUMN "comment";

ALTER TABLE "SpecialistReview" ADD COLUMN "publishedComment" TEXT;
ALTER TABLE "SpecialistReview" ADD COLUMN "pendingCommentDraft" TEXT;

UPDATE "SpecialistReview"
SET "publishedComment" = "comment",
    "pendingCommentDraft" = NULL
WHERE "publicationModerationStatus" = 'approved'
  AND "comment" IS NOT NULL
  AND length(trim("comment")) > 0;

UPDATE "SpecialistReview"
SET "publishedComment" = NULL,
    "pendingCommentDraft" = "comment"
WHERE "publicationModerationStatus" <> 'approved'
  AND "comment" IS NOT NULL
  AND length(trim("comment")) > 0;

ALTER TABLE "SpecialistReview" DROP COLUMN "comment";

-- 6. User: уже одобренные имена во витрине
UPDATE "User"
SET "catalogListedName" = "name"
WHERE "nameModerationStatus" = 'approved';

-- 7. Одна ревизия на организацию из текущего снимка
INSERT INTO "OrganizationProfileRevision" ("id", "organizationId", "status", "name", "description", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    CASE
        WHEN o."publicationModerationStatus" = 'approved'::"PublicationModerationStatus"
            THEN 'published'::"OrganizationProfileRevisionStatus"
        ELSE 'pending_review'::"OrganizationProfileRevisionStatus"
    END,
    o."name",
    o."description",
    NOW(),
    NOW()
FROM "Organization" o
WHERE o."deletedAt" IS NULL;

INSERT INTO "OrganizationProfileRevisionLocale" (
    "id", "revisionId", "locale", "name", "description", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    r."id",
    ol."locale",
    ol."name",
    ol."description",
    NOW(),
    NOW()
FROM "OrganizationLocale" ol
INNER JOIN "OrganizationProfileRevision" r ON r."organizationId" = ol."organizationId";

-- 8. Копия витринной галереи на ревизию
INSERT INTO "Gallery" ("id", "ownerKind", "ownerId", "createdAt")
SELECT gen_random_uuid()::text, 'organization_profile_revision'::"GalleryOwnerKind", r."id", NOW()
FROM "OrganizationProfileRevision" r;

INSERT INTO "GalleryItem" ("id", "galleryId", "url", "alt", "kind", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    rev_gallery."id",
    gi."url",
    gi."alt",
    gi."kind",
    gi."sortOrder",
    NOW()
FROM "GalleryItem" gi
INNER JOIN "Gallery" og
    ON og."id" = gi."galleryId"
    AND og."ownerKind" = 'organization'::"GalleryOwnerKind"
INNER JOIN "Gallery" rev_gallery
    ON rev_gallery."ownerKind" = 'organization_profile_revision'::"GalleryOwnerKind"
    AND rev_gallery."ownerId" = (
        SELECT r2."id"
        FROM "OrganizationProfileRevision" r2
        WHERE r2."organizationId" = og."ownerId"
        ORDER BY r2."createdAt" DESC
        LIMIT 1
    );

-- 9. Указатель опубликованной ревизии и FK
UPDATE "Organization" o
SET "publishedProfileRevisionId" = r."id"
FROM "OrganizationProfileRevision" r
WHERE r."organizationId" = o."id"
  AND r."status" = 'published'::"OrganizationProfileRevisionStatus";

ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_publishedProfileRevisionId_fkey"
    FOREIGN KEY ("publishedProfileRevisionId") REFERENCES "OrganizationProfileRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. Кейсы: subjectId профиля → id ревизии
UPDATE "ContentModerationCase" c
SET "subjectId" = (
    SELECT r."id"
    FROM "OrganizationProfileRevision" r
    WHERE r."organizationId" = c."subjectId"
    ORDER BY
        CASE r."status"
            WHEN 'published'::"OrganizationProfileRevisionStatus" THEN 0
            WHEN 'pending_review'::"OrganizationProfileRevisionStatus" THEN 1
            ELSE 2
        END,
        r."createdAt" DESC
    LIMIT 1
)
WHERE c."kind" = 'organization_profile';
