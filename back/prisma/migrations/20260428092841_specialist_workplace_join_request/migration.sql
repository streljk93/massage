-- CreateEnum
CREATE TYPE "SpecialistWorkplaceJoinRequestStatus" AS ENUM ('pending', 'withdrawn', 'accepted', 'rejected');

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

-- CreateIndex
CREATE INDEX "SpecialistWorkplaceJoinRequest_specialistId_status_idx" ON "SpecialistWorkplaceJoinRequest"("specialistId", "status");

-- CreateIndex
CREATE INDEX "SpecialistWorkplaceJoinRequest_organizationId_status_idx" ON "SpecialistWorkplaceJoinRequest"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistWorkplaceJoinRequest_specialistId_organizationId_key" ON "SpecialistWorkplaceJoinRequest"("specialistId", "organizationId");

-- AddForeignKey
ALTER TABLE "SpecialistWorkplaceJoinRequest" ADD CONSTRAINT "SpecialistWorkplaceJoinRequest_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistWorkplaceJoinRequest" ADD CONSTRAINT "SpecialistWorkplaceJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
