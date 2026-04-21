-- CreateEnum
CREATE TYPE "AdvertOwnerKind" AS ENUM ('internal', 'external');

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "ownerKind" "AdvertOwnerKind" NOT NULL DEFAULT 'internal',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisementLocale" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisementLocale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Advertisement_placement_isActive_deletedAt_sortOrder_idx" ON "Advertisement"("placement", "isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "AdvertisementLocale_locale_idx" ON "AdvertisementLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisementLocale_advertisementId_locale_key" ON "AdvertisementLocale"("advertisementId", "locale");

-- AddForeignKey
ALTER TABLE "AdvertisementLocale" ADD CONSTRAINT "AdvertisementLocale_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
