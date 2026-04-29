-- CreateEnum
CREATE TYPE "GalleryOwnerKind" AS ENUM ('organization');

-- CreateEnum
CREATE TYPE "GalleryMediaKind" AS ENUM ('image', 'video');

-- CreateTable
CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL,
    "ownerKind" "GalleryOwnerKind" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gallery_ownerKind_ownerId_key" ON "Gallery"("ownerKind", "ownerId");

-- CreateIndex
CREATE INDEX "Gallery_ownerId_idx" ON "Gallery"("ownerId");

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "kind" "GalleryMediaKind" NOT NULL DEFAULT 'image',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryItem_galleryId_sortOrder_idx" ON "GalleryItem"("galleryId", "sortOrder");

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- migrate: one Gallery per organization that had vitrine images or gallery rows
INSERT INTO "Gallery" ("id", "ownerKind", "ownerId", "createdAt")
SELECT gen_random_uuid()::text, 'organization'::"GalleryOwnerKind", o."id", o."createdAt"
FROM "Organization" o
WHERE o."deletedAt" IS NULL
AND (
    EXISTS (SELECT 1 FROM "OrganizationGalleryItem" gi WHERE gi."organizationId" = o."id")
    OR TRIM(COALESCE(o."imageUrl", '')) <> ''
);

-- migrate: legacy cover on Organization (became first item by sortOrder)
INSERT INTO "GalleryItem" ("id", "galleryId", "url", "alt", "kind", "sortOrder", "createdAt")
SELECT gen_random_uuid()::text, g."id", TRIM(o."imageUrl"), o."imageAlt", 'image'::"GalleryMediaKind", 0, o."createdAt"
FROM "Organization" o
INNER JOIN "Gallery" g ON g."ownerId" = o."id" AND g."ownerKind" = 'organization'
WHERE o."deletedAt" IS NULL
AND TRIM(COALESCE(o."imageUrl", '')) <> '';

-- migrate: former `OrganizationGalleryItem` rows (skip URL duplicate of legacy cover)
INSERT INTO "GalleryItem" ("id", "galleryId", "url", "alt", "kind", "sortOrder", "createdAt")
SELECT
    gi."id",
    g."id",
    gi."url",
    gi."alt",
    CASE gi."kind"::text
        WHEN 'image' THEN 'image'::"GalleryMediaKind"
        WHEN 'video' THEN 'video'::"GalleryMediaKind"
        ELSE 'image'::"GalleryMediaKind"
    END,
    gi."sortOrder" + CASE WHEN TRIM(COALESCE(o."imageUrl", '')) <> '' THEN 1 ELSE 0 END,
    gi."createdAt"
FROM "OrganizationGalleryItem" gi
INNER JOIN "Organization" o ON o."id" = gi."organizationId"
INNER JOIN "Gallery" g ON g."ownerId" = o."id" AND g."ownerKind" = 'organization'
WHERE NOT (
    TRIM(COALESCE(o."imageUrl", '')) <> ''
    AND TRIM(gi."url") = TRIM(o."imageUrl")
);

-- DropTable
DROP TABLE "OrganizationGalleryItem";

-- DropEnum
DROP TYPE "OrganizationGalleryMediaKind";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "imageUrl",
DROP COLUMN "imageAlt";
