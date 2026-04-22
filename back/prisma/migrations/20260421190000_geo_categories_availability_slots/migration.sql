-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "OrganizationServiceCategory" (
    "organizationId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationServiceCategory_pkey" PRIMARY KEY ("organizationId","serviceCategoryId")
);

-- CreateTable
CREATE TABLE "SpecialistServiceCategory" (
    "specialistId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistServiceCategory_pkey" PRIMARY KEY ("specialistId","serviceCategoryId")
);

-- CreateIndex
CREATE INDEX "OrganizationServiceCategory_serviceCategoryId_idx" ON "OrganizationServiceCategory"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "SpecialistServiceCategory_serviceCategoryId_idx" ON "SpecialistServiceCategory"("serviceCategoryId");

-- AddForeignKey
ALTER TABLE "OrganizationServiceCategory" ADD CONSTRAINT "OrganizationServiceCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationServiceCategory" ADD CONSTRAINT "OrganizationServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistServiceCategory" ADD CONSTRAINT "SpecialistServiceCategory_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistServiceCategory" ADD CONSTRAINT "SpecialistServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
