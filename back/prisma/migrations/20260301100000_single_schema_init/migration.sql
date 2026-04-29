-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'expired', 'reject_by_master', 'reject_by_client', 'confirmed', 'canceled_by_master', 'canceled_by_client', 'no_show_by_client', 'no_show_by_master', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "AdvertOwnerKind" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('owner', 'admin', 'specialist');

-- CreateEnum
CREATE TYPE "SpecialistWorkplaceJoinRequestStatus" AS ENUM ('pending', 'withdrawn', 'accepted', 'rejected', 'blocked');

-- CreateEnum
CREATE TYPE "FavoriteTargetKind" AS ENUM ('organization', 'specialist');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google');

-- CreateEnum
CREATE TYPE "PublicationModerationStatus" AS ENUM ('approved', 'pending_review', 'rejected');

-- CreateEnum
CREATE TYPE "ContentModerationCaseKind" AS ENUM ('organization_profile', 'organization_review', 'specialist_review', 'user_display_name');

-- CreateEnum
CREATE TYPE "ContentModerationCaseStatus" AS ENUM ('open', 'resolved_approved', 'resolved_rejected');

-- CreateEnum
CREATE TYPE "GalleryOwnerKind" AS ENUM ('organization');

-- CreateEnum
CREATE TYPE "GalleryMediaKind" AS ENUM ('image', 'video');

-- CreateTable
CREATE TABLE "BookingStatusLocale" (
    "status" "BookingStatus" NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "BookingStatusLocale_pkey" PRIMARY KEY ("status","locale")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT,
    "bookingReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bookingReminderLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "nameModerationStatus" "PublicationModerationStatus" NOT NULL DEFAULT 'approved',
    "isContentModerator" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFcmToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFavorite" (
    "userId" TEXT NOT NULL,
    "targetKind" "FavoriteTargetKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("userId","targetKind","targetId")
);

-- CreateTable
CREATE TABLE "UserBehaviorEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBehaviorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferenceProfile" (
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "profile" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferenceProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MajorServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MajorServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MajorServiceCategoryLocale" (
    "id" TEXT NOT NULL,
    "majorServiceCategoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MajorServiceCategoryLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "majorServiceCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategoryLocale" (
    "id" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategoryLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourceProvider" TEXT,
    "sourceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "addressId" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "yearsInBusiness" INTEGER,
    "listingWorkdayStartMinute" INTEGER NOT NULL DEFAULT 480,
    "listingWorkdayEndMinute" INTEGER NOT NULL DEFAULT 1320,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "bookingConfirmationGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "publicationModerationStatus" "PublicationModerationStatus" NOT NULL DEFAULT 'approved',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL,
    "ownerKind" "GalleryOwnerKind" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "OrganizationLocale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationServiceCategory" (
    "organizationId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationServiceCategory_pkey" PRIMARY KEY ("organizationId","serviceCategoryId")
);

-- CreateTable
CREATE TABLE "OrganizationReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "publicationModerationStatus" "PublicationModerationStatus" NOT NULL DEFAULT 'approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "experienceYears" INTEGER,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "activeOrganizationId" TEXT,
    "listedInDirectory" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "autoConfirmBookings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Specialist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistMassageProfile" (
    "specialistId" TEXT NOT NULL,
    "pressureLevel" INTEGER,
    "pressureAdaptsToClient" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistMassageProfile_pkey" PRIMARY KEY ("specialistId")
);

-- CreateTable
CREATE TABLE "SpecialistServiceCategory" (
    "specialistId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistServiceCategory_pkey" PRIMARY KEY ("specialistId","serviceCategoryId")
);

-- CreateTable
CREATE TABLE "SpecialistOrganizationEmployment" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'specialist',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistOrganizationEmployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistWorkplaceJoinRequest" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "SpecialistWorkplaceJoinRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SpecialistWorkplaceJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "categoryId" TEXT NOT NULL,
    "specialistId" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePriceOption" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePriceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistReview" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "publicationModerationStatus" "PublicationModerationStatus" NOT NULL DEFAULT 'approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpecialistReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentModerationCase" (
    "id" TEXT NOT NULL,
    "kind" "ContentModerationCaseKind" NOT NULL,
    "status" "ContentModerationCaseStatus" NOT NULL DEFAULT 'open',
    "organizationId" TEXT,
    "organizationReviewId" TEXT,
    "specialistReviewId" TEXT,
    "targetUserId" TEXT,
    "aiSummary" TEXT,
    "moderatorUserId" TEXT,
    "moderatorReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "organizationId" TEXT,
    "serviceId" TEXT,
    "categoryShortNameSnapshot" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "priceAmountSnapshot" INTEGER,
    "currencySnapshot" TEXT DEFAULT 'VND',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "pendingExpiresAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancellationComment" TEXT,
    "clientReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

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
    "refKey" TEXT,
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
CREATE INDEX "BookingStatusLocale_locale_idx" ON "BookingStatusLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserOAuthAccount_userId_idx" ON "UserOAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOAuthAccount_provider_providerAccountId_key" ON "UserOAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");

-- CreateIndex
CREATE INDEX "PendingRegistration_expiresAt_idx" ON "PendingRegistration"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFcmToken_token_key" ON "UserFcmToken"("token");

-- CreateIndex
CREATE INDEX "UserFcmToken_userId_idx" ON "UserFcmToken"("userId");

-- CreateIndex
CREATE INDEX "UserFavorite_userId_idx" ON "UserFavorite"("userId");

-- CreateIndex
CREATE INDEX "UserBehaviorEvent_userId_createdAt_idx" ON "UserBehaviorEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserBehaviorEvent_sessionId_createdAt_idx" ON "UserBehaviorEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "UserBehaviorEvent_eventType_createdAt_idx" ON "UserBehaviorEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MajorServiceCategory_slug_key" ON "MajorServiceCategory"("slug");

-- CreateIndex
CREATE INDEX "MajorServiceCategoryLocale_locale_idx" ON "MajorServiceCategoryLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "MajorServiceCategoryLocale_majorServiceCategoryId_locale_key" ON "MajorServiceCategoryLocale"("majorServiceCategoryId", "locale");

-- CreateIndex
CREATE INDEX "ServiceCategory_majorServiceCategoryId_idx" ON "ServiceCategory"("majorServiceCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_majorServiceCategoryId_slug_key" ON "ServiceCategory"("majorServiceCategoryId", "slug");

-- CreateIndex
CREATE INDEX "ServiceCategoryLocale_locale_idx" ON "ServiceCategoryLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategoryLocale_serviceCategoryId_locale_key" ON "ServiceCategoryLocale"("serviceCategoryId", "locale");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE INDEX "Address_latitude_longitude_idx" ON "Address"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE INDEX "Organization_addressId_idx" ON "Organization"("addressId");

-- CreateIndex
CREATE INDEX "Gallery_ownerId_idx" ON "Gallery"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Gallery_ownerKind_ownerId_key" ON "Gallery"("ownerKind", "ownerId");

-- CreateIndex
CREATE INDEX "GalleryItem_galleryId_sortOrder_idx" ON "GalleryItem"("galleryId", "sortOrder");

-- CreateIndex
CREATE INDEX "OrganizationLocale_locale_idx" ON "OrganizationLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLocale_organizationId_locale_key" ON "OrganizationLocale"("organizationId", "locale");

-- CreateIndex
CREATE INDEX "OrganizationServiceCategory_serviceCategoryId_idx" ON "OrganizationServiceCategory"("serviceCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationReview_bookingId_key" ON "OrganizationReview"("bookingId");

-- CreateIndex
CREATE INDEX "OrganizationReview_organizationId_idx" ON "OrganizationReview"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationReview_authorUserId_idx" ON "OrganizationReview"("authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_userId_key" ON "Specialist"("userId");

-- CreateIndex
CREATE INDEX "Specialist_activeOrganizationId_idx" ON "Specialist"("activeOrganizationId");

-- CreateIndex
CREATE INDEX "SpecialistServiceCategory_serviceCategoryId_idx" ON "SpecialistServiceCategory"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "SpecialistOrganizationEmployment_specialistId_idx" ON "SpecialistOrganizationEmployment"("specialistId");

-- CreateIndex
CREATE INDEX "SpecialistOrganizationEmployment_organizationId_idx" ON "SpecialistOrganizationEmployment"("organizationId");

-- CreateIndex
CREATE INDEX "SpecialistOrganizationEmployment_isActive_idx" ON "SpecialistOrganizationEmployment"("isActive");

-- CreateIndex
CREATE INDEX "SpecialistOrganizationEmployment_role_idx" ON "SpecialistOrganizationEmployment"("role");

-- CreateIndex
CREATE INDEX "SpecialistWorkplaceJoinRequest_specialistId_status_idx" ON "SpecialistWorkplaceJoinRequest"("specialistId", "status");

-- CreateIndex
CREATE INDEX "SpecialistWorkplaceJoinRequest_organizationId_status_idx" ON "SpecialistWorkplaceJoinRequest"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistWorkplaceJoinRequest_specialistId_organizationId_key" ON "SpecialistWorkplaceJoinRequest"("specialistId", "organizationId");

-- CreateIndex
CREATE INDEX "Service_organizationId_slug_idx" ON "Service"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Service_specialistId_slug_idx" ON "Service"("specialistId", "slug");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- CreateIndex
CREATE INDEX "Service_specialistId_idx" ON "Service"("specialistId");

-- CreateIndex
CREATE INDEX "ServicePriceOption_serviceId_idx" ON "ServicePriceOption"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePriceOption_serviceId_durationMinutes_key" ON "ServicePriceOption"("serviceId", "durationMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistReview_bookingId_key" ON "SpecialistReview"("bookingId");

-- CreateIndex
CREATE INDEX "SpecialistReview_specialistId_idx" ON "SpecialistReview"("specialistId");

-- CreateIndex
CREATE INDEX "SpecialistReview_authorUserId_idx" ON "SpecialistReview"("authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentModerationCase_organizationReviewId_key" ON "ContentModerationCase"("organizationReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentModerationCase_specialistReviewId_key" ON "ContentModerationCase"("specialistReviewId");

-- CreateIndex
CREATE INDEX "ContentModerationCase_status_createdAt_idx" ON "ContentModerationCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentModerationCase_organizationId_idx" ON "ContentModerationCase"("organizationId");

-- CreateIndex
CREATE INDEX "ContentModerationCase_targetUserId_idx" ON "ContentModerationCase"("targetUserId");

-- CreateIndex
CREATE INDEX "Booking_clientUserId_idx" ON "Booking"("clientUserId");

-- CreateIndex
CREATE INDEX "Booking_specialistId_idx" ON "Booking"("specialistId");

-- CreateIndex
CREATE INDEX "Booking_organizationId_idx" ON "Booking"("organizationId");

-- CreateIndex
CREATE INDEX "Booking_startsAt_idx" ON "Booking"("startsAt");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_status_pendingExpiresAt_idx" ON "Booking"("status", "pendingExpiresAt");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_idx" ON "BookingStatusHistory"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertisement_refKey_key" ON "Advertisement"("refKey");

-- CreateIndex
CREATE INDEX "Advertisement_placement_isActive_deletedAt_sortOrder_idx" ON "Advertisement"("placement", "isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "AdvertisementLocale_locale_idx" ON "AdvertisementLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisementLocale_advertisementId_locale_key" ON "AdvertisementLocale"("advertisementId", "locale");

-- AddForeignKey
ALTER TABLE "UserOAuthAccount" ADD CONSTRAINT "UserOAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFcmToken" ADD CONSTRAINT "UserFcmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBehaviorEvent" ADD CONSTRAINT "UserBehaviorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceProfile" ADD CONSTRAINT "UserPreferenceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MajorServiceCategoryLocale" ADD CONSTRAINT "MajorServiceCategoryLocale_majorServiceCategoryId_fkey" FOREIGN KEY ("majorServiceCategoryId") REFERENCES "MajorServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_majorServiceCategoryId_fkey" FOREIGN KEY ("majorServiceCategoryId") REFERENCES "MajorServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategoryLocale" ADD CONSTRAINT "ServiceCategoryLocale_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationLocale" ADD CONSTRAINT "OrganizationLocale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationServiceCategory" ADD CONSTRAINT "OrganizationServiceCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationServiceCategory" ADD CONSTRAINT "OrganizationServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReview" ADD CONSTRAINT "OrganizationReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReview" ADD CONSTRAINT "OrganizationReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReview" ADD CONSTRAINT "OrganizationReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialist" ADD CONSTRAINT "Specialist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialist" ADD CONSTRAINT "Specialist_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistMassageProfile" ADD CONSTRAINT "SpecialistMassageProfile_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistServiceCategory" ADD CONSTRAINT "SpecialistServiceCategory_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistServiceCategory" ADD CONSTRAINT "SpecialistServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistOrganizationEmployment" ADD CONSTRAINT "SpecialistOrganizationEmployment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistOrganizationEmployment" ADD CONSTRAINT "SpecialistOrganizationEmployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistWorkplaceJoinRequest" ADD CONSTRAINT "SpecialistWorkplaceJoinRequest_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistWorkplaceJoinRequest" ADD CONSTRAINT "SpecialistWorkplaceJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceOption" ADD CONSTRAINT "ServicePriceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistReview" ADD CONSTRAINT "SpecialistReview_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistReview" ADD CONSTRAINT "SpecialistReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistReview" ADD CONSTRAINT "SpecialistReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_organizationReviewId_fkey" FOREIGN KEY ("organizationReviewId") REFERENCES "OrganizationReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_specialistReviewId_fkey" FOREIGN KEY ("specialistReviewId") REFERENCES "SpecialistReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentModerationCase" ADD CONSTRAINT "ContentModerationCase_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisementLocale" ADD CONSTRAINT "AdvertisementLocale_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

