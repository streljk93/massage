-- CreateEnum
CREATE TYPE "OrganizationGalleryMediaKind" AS ENUM ('image', 'video');

-- Rename legacy table from organization_media migration
ALTER TABLE "OrganizationMedia" RENAME TO "OrganizationGalleryItem";

ALTER INDEX "OrganizationMedia_organizationId_sortOrder_idx" RENAME TO "OrganizationGalleryItem_organizationId_sortOrder_idx";

ALTER TABLE "OrganizationGalleryItem" RENAME CONSTRAINT "OrganizationMedia_pkey" TO "OrganizationGalleryItem_pkey";

ALTER TABLE "OrganizationGalleryItem" RENAME CONSTRAINT "OrganizationMedia_organizationId_fkey" TO "OrganizationGalleryItem_organizationId_fkey";

-- AlterTable
ALTER TABLE "OrganizationGalleryItem" ADD COLUMN "kind" "OrganizationGalleryMediaKind" NOT NULL DEFAULT 'image';
