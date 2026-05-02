-- Ревизии витринного профиля мастера; предмодерация по `SpecialistProfileRevision.id` (как у организаций).

CREATE TYPE "SpecialistProfileRevisionStatus" AS ENUM ('pending_review', 'published', 'rejected', 'superseded');

CREATE TABLE "SpecialistProfileRevision" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "status" "SpecialistProfileRevisionStatus" NOT NULL DEFAULT 'pending_review',
    "listingName" TEXT,
    "bio" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistProfileRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpecialistProfileRevision_specialistId_idx" ON "SpecialistProfileRevision"("specialistId");
CREATE INDEX "SpecialistProfileRevision_specialistId_status_idx" ON "SpecialistProfileRevision"("specialistId", "status");

ALTER TABLE "SpecialistProfileRevision"
ADD CONSTRAINT "SpecialistProfileRevision_specialistId_fkey"
FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Specialist" ADD COLUMN "publishedProfileRevisionId" TEXT;

CREATE UNIQUE INDEX "Specialist_publishedProfileRevisionId_key" ON "Specialist"("publishedProfileRevisionId");

ALTER TABLE "Specialist"
ADD CONSTRAINT "Specialist_publishedProfileRevisionId_fkey"
FOREIGN KEY ("publishedProfileRevisionId") REFERENCES "SpecialistProfileRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Одобренные профили: одна опубликованная ревизия = текущий снимок в `Specialist`.
WITH approved_ins AS (
    INSERT INTO "SpecialistProfileRevision" ("id", "specialistId", "status", "listingName", "bio", "imageUrl", "imageAlt", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text,
           s.id,
           'published'::"SpecialistProfileRevisionStatus",
           s."listingName",
           s."bio",
           s."imageUrl",
           s."imageAlt",
           CURRENT_TIMESTAMP,
           CURRENT_TIMESTAMP
    FROM "Specialist" s
    WHERE s."deletedAt" IS NULL
      AND s."profilePublicationModerationStatus" = 'approved'
    RETURNING "id", "specialistId"
)
UPDATE "Specialist" s
SET "publishedProfileRevisionId" = a.id
FROM approved_ins a
WHERE s.id = a."specialistId";

-- Pending/rejected со старым снимком в `catalogListed*`: опубликованная ревизия из заморозки + черновик из живых колонок.
DO $$
DECLARE
    rec RECORD;
    pub_id TEXT;
    pend_id TEXT;
    pub_listing TEXT;
    pub_bio TEXT;
    pub_img TEXT;
BEGIN
    FOR rec IN
        SELECT s.*
        FROM "Specialist" s
        WHERE s."deletedAt" IS NULL
          AND s."profilePublicationModerationStatus" IN ('pending_review', 'rejected')
          AND (
              (s."catalogListedListingName" IS NOT NULL AND TRIM(s."catalogListedListingName") <> '')
              OR (s."catalogListedBio" IS NOT NULL AND TRIM(s."catalogListedBio") <> '')
              OR (s."catalogListedImageUrl" IS NOT NULL AND TRIM(s."catalogListedImageUrl") <> '')
          )
    LOOP
        pub_id := gen_random_uuid()::text;
        pend_id := gen_random_uuid()::text;

        IF rec."catalogListedListingName" IS NOT NULL AND TRIM(rec."catalogListedListingName") <> '' THEN
            pub_listing := TRIM(rec."catalogListedListingName");
        ELSE
            pub_listing := NULLIF(TRIM(COALESCE(rec."listingName", '')), '');
        END IF;

        IF rec."catalogListedBio" IS NOT NULL AND TRIM(rec."catalogListedBio") <> '' THEN
            pub_bio := TRIM(rec."catalogListedBio");
        ELSE
            pub_bio := rec."bio";
        END IF;

        IF rec."catalogListedImageUrl" IS NOT NULL AND TRIM(rec."catalogListedImageUrl") <> '' THEN
            pub_img := TRIM(rec."catalogListedImageUrl");
        ELSE
            pub_img := rec."imageUrl";
        END IF;

        INSERT INTO "SpecialistProfileRevision" ("id", "specialistId", "status", "listingName", "bio", "imageUrl", "imageAlt", "createdAt", "updatedAt")
        VALUES (pub_id, rec.id, 'published'::"SpecialistProfileRevisionStatus", pub_listing, pub_bio, pub_img, rec."imageAlt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

        INSERT INTO "SpecialistProfileRevision" ("id", "specialistId", "status", "listingName", "bio", "imageUrl", "imageAlt", "createdAt", "updatedAt")
        VALUES (pend_id, rec.id, 'pending_review'::"SpecialistProfileRevisionStatus", rec."listingName", rec."bio", rec."imageUrl", rec."imageAlt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

        UPDATE "Specialist"
        SET "publishedProfileRevisionId" = pub_id,
            "listingName" = pub_listing,
            "bio" = pub_bio,
            "imageUrl" = pub_img,
            "catalogListedListingName" = NULL,
            "catalogListedBio" = NULL,
            "catalogListedImageUrl" = NULL
        WHERE id = rec.id;

        UPDATE "ContentModerationCase"
        SET "subjectId" = pend_id
        WHERE "kind" = 'specialist_profile'
          AND "status" = 'open'
          AND "subjectId" = rec.id;
    END LOOP;
END $$;

-- Остальные pending/rejected без опубликованной ревизии: один черновик pending_review.
WITH pend_ins AS (
    INSERT INTO "SpecialistProfileRevision" ("id", "specialistId", "status", "listingName", "bio", "imageUrl", "imageAlt", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text,
           s.id,
           'pending_review'::"SpecialistProfileRevisionStatus",
           s."listingName",
           s."bio",
           s."imageUrl",
           s."imageAlt",
           CURRENT_TIMESTAMP,
           CURRENT_TIMESTAMP
    FROM "Specialist" s
    WHERE s."deletedAt" IS NULL
      AND s."profilePublicationModerationStatus" IN ('pending_review', 'rejected')
      AND s."publishedProfileRevisionId" IS NULL
    RETURNING "id", "specialistId"
)
UPDATE "ContentModerationCase" c
SET "subjectId" = p.id
FROM pend_ins p
WHERE c."kind" = 'specialist_profile'
  AND c."status" = 'open'
  AND c."subjectId" = p."specialistId";
