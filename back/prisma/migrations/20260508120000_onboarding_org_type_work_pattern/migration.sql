-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('solo', 'business');

-- CreateEnum
CREATE TYPE "SpecialistWorkPattern" AS ENUM ('solo', 'business', 'employed_salon');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "organizationType" "OrganizationType" NOT NULL DEFAULT 'business';

-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN "onboardingWorkPattern" "SpecialistWorkPattern";

-- CreateTable
CREATE TABLE "SpecialistOnboardingMajorServiceCategory" (
    "specialistId" TEXT NOT NULL,
    "majorServiceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistOnboardingMajorServiceCategory_pkey" PRIMARY KEY ("specialistId","majorServiceCategoryId")
);

-- CreateIndex
CREATE INDEX "SpecialistOnboardingMajorServiceCategory_majorServiceCategoryId_idx" ON "SpecialistOnboardingMajorServiceCategory"("majorServiceCategoryId");

-- AddForeignKey
ALTER TABLE "SpecialistOnboardingMajorServiceCategory" ADD CONSTRAINT "SpecialistOnboardingMajorServiceCategory_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistOnboardingMajorServiceCategory" ADD CONSTRAINT "SpecialistOnboardingMajorServiceCategory_majorServiceCategoryId_fkey" FOREIGN KEY ("majorServiceCategoryId") REFERENCES "MajorServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
