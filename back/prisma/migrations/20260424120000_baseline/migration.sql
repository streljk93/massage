-- Baseline: full schema as of current prisma/schema.prisma (replaces previous incremental migrations).
-- Apply only on empty DB (`prisma migrate reset`). Includes BookingStatusLocale seed + partial unique index for org owner + UserFcmToken.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'expired', 'reject_by_master', 'reject_by_client', 'confirmed', 'canceled_by_master', 'canceled_by_client', 'no_show_by_client', 'no_show_by_master', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "AdvertOwnerKind" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('owner', 'admin', 'specialist');

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "yearsInBusiness" INTEGER,
    "listingMetaLine" TEXT,
    "listingServicesLine" TEXT,
    "listingSlotGroups" JSONB,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "bookingConfirmationGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
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
    "clientsLabel" TEXT,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "activeOrganizationId" TEXT,
    "listingMetaLine" TEXT,
    "listingServicesLine" TEXT,
    "listingSlotGroups" JSONB,
    "listedInDirectory" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirmBookings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Specialist_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "specialistId" TEXT,
    "name" TEXT NOT NULL,
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
CREATE TABLE "ServiceLocale" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLocale_pkey" PRIMARY KEY ("id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpecialistReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "organizationId" TEXT,
    "serviceId" TEXT,
    "serviceNameSnapshot" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "priceAmountSnapshot" INTEGER,
    "currencySnapshot" TEXT DEFAULT 'VND',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "pendingExpiresAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancellationComment" TEXT,
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
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE INDEX "Organization_city_idx" ON "Organization"("city");

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
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- CreateIndex
CREATE INDEX "Service_specialistId_idx" ON "Service"("specialistId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_organizationId_slug_key" ON "Service"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "ServiceLocale_locale_idx" ON "ServiceLocale"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLocale_serviceId_locale_key" ON "ServiceLocale"("serviceId", "locale");

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
ALTER TABLE "MajorServiceCategoryLocale" ADD CONSTRAINT "MajorServiceCategoryLocale_majorServiceCategoryId_fkey" FOREIGN KEY ("majorServiceCategoryId") REFERENCES "MajorServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_majorServiceCategoryId_fkey" FOREIGN KEY ("majorServiceCategoryId") REFERENCES "MajorServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategoryLocale" ADD CONSTRAINT "ServiceCategoryLocale_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "SpecialistServiceCategory" ADD CONSTRAINT "SpecialistServiceCategory_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistServiceCategory" ADD CONSTRAINT "SpecialistServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistOrganizationEmployment" ADD CONSTRAINT "SpecialistOrganizationEmployment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistOrganizationEmployment" ADD CONSTRAINT "SpecialistOrganizationEmployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLocale" ADD CONSTRAINT "ServiceLocale_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceOption" ADD CONSTRAINT "ServicePriceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistReview" ADD CONSTRAINT "SpecialistReview_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistReview" ADD CONSTRAINT "SpecialistReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistReview" ADD CONSTRAINT "SpecialistReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- BookingStatusLocale: seed labels (en, vi, ru), aligned with BookingStatus enum.
INSERT INTO "BookingStatusLocale" ("status", "locale", "label") VALUES
('pending', 'en', 'Awaiting confirmation'),
('expired', 'en', 'Booking was not confirmed'),
('reject_by_master', 'en', 'Declined by specialist'),
('reject_by_client', 'en', 'Canceled by you'),
('confirmed', 'en', 'Confirmed'),
('canceled_by_master', 'en', 'Canceled by specialist'),
('canceled_by_client', 'en', 'Canceled by you'),
('no_show_by_client', 'en', 'No-show (you did not attend)'),
('no_show_by_master', 'en', 'No-show (specialist)'),
('in_progress', 'en', 'In progress'),
('done', 'en', 'Completed'),
('pending', 'vi', 'Đang chờ xác nhận'),
('expired', 'vi', 'Lịch chưa được xác nhận'),
('reject_by_master', 'vi', 'Chuyên gia từ chối'),
('reject_by_client', 'vi', 'Bạn đã hủy'),
('confirmed', 'vi', 'Đã xác nhận'),
('canceled_by_master', 'vi', 'Chuyên gia đã hủy'),
('canceled_by_client', 'vi', 'Bạn đã hủy'),
('no_show_by_client', 'vi', 'Không đến (phía bạn)'),
('no_show_by_master', 'vi', 'Không đến (phía chuyên gia)'),
('in_progress', 'vi', 'Đang thực hiện'),
('done', 'vi', 'Đã hoàn thành'),
('pending', 'ru', 'Ожидает подтверждения'),
('expired', 'ru', 'Запись не была подтверждена'),
('reject_by_master', 'ru', 'Отклонено специалистом'),
('reject_by_client', 'ru', 'Отменено вами'),
('confirmed', 'ru', 'Подтверждено'),
('canceled_by_master', 'ru', 'Отменено специалистом'),
('canceled_by_client', 'ru', 'Отменено вами'),
('no_show_by_client', 'ru', 'Неявка (клиент)'),
('no_show_by_master', 'ru', 'Неявка (специалист)'),
('in_progress', 'ru', 'Услуга выполняется'),
('done', 'ru', 'Завершено');

-- Partial unique: at most one owner membership row per organization (not modeled in Prisma DSL).
CREATE UNIQUE INDEX "SpecialistOrganizationEmployment_one_owner_per_organization"
  ON "SpecialistOrganizationEmployment" ("organizationId")
  WHERE "role" = 'owner'::"OrganizationMembershipRole";

-- UserFcmToken: web push (FCM); ранее отдельная миграция 20260424150000_user_fcm_tokens.
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

-- CreateIndex
CREATE UNIQUE INDEX "UserFcmToken_token_key" ON "UserFcmToken"("token");

-- CreateIndex
CREATE INDEX "UserFcmToken_userId_idx" ON "UserFcmToken"("userId");

-- AddForeignKey
ALTER TABLE "UserFcmToken" ADD CONSTRAINT "UserFcmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
