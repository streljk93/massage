-- CreateEnum
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('owner', 'admin', 'specialist');

-- AlterTable
ALTER TABLE "SpecialistOrganizationEmployment" ADD COLUMN     "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'specialist';

-- CreateIndex
CREATE INDEX "SpecialistOrganizationEmployment_role_idx" ON "SpecialistOrganizationEmployment"("role");
