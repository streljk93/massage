-- Hiring marketplace: vacancies, resumes, contacts and search projection.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "SpecialistResumeVisibility" AS ENUM ('public', 'private');
CREATE TYPE "JobPostingStatus" AS ENUM ('draft', 'open', 'closed');
CREATE TYPE "HiringContactSource" AS ENUM ('application');
CREATE TYPE "HiringContactStatus" AS ENUM ('pending', 'accepted', 'rejected', 'closed');
CREATE TYPE "JobApplicationStatus" AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE "OrganizationSpecialistInvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'canceled');

CREATE TABLE "SpecialistResume" (
  "id" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "headline" TEXT,
  "summary" TEXT,
  "experienceYears" INTEGER,
  "visibility" "SpecialistResumeVisibility" NOT NULL DEFAULT 'private',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "SpecialistResume_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialistSearchProjection" (
  "specialistId" TEXT NOT NULL,
  "skillsCategoryIds" TEXT[] NOT NULL,
  "experienceYears" INTEGER,
  "textSearch" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SpecialistSearchProjection_pkey" PRIMARY KEY ("specialistId")
);

CREATE TABLE "JobPosting" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "organizationOfferingId" TEXT,
  "serviceCategoryId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "requirements" TEXT,
  "experienceMinYears" INTEGER,
  "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'specialist',
  "status" "JobPostingStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HiringContact" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "jobPostingId" TEXT,
  "createdByUserId" TEXT,
  "source" "HiringContactSource" NOT NULL,
  "status" "HiringContactStatus" NOT NULL DEFAULT 'pending',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "HiringContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobApplication" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "status" "JobApplicationStatus" NOT NULL DEFAULT 'pending',
  "message" TEXT,
  "jobPostingSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSpecialistInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "targetRole" "OrganizationMembershipRole" NOT NULL DEFAULT 'specialist',
  "status" "OrganizationSpecialistInvitationStatus" NOT NULL DEFAULT 'pending',
  "message" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "OrganizationSpecialistInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialistResume_specialistId_key"
  ON "SpecialistResume"("specialistId");
CREATE INDEX "SpecialistResume_visibility_deletedAt_idx"
  ON "SpecialistResume"("visibility", "deletedAt");
CREATE INDEX "SpecialistResume_experienceYears_idx"
  ON "SpecialistResume"("experienceYears");

CREATE INDEX "SpecialistSearchProjection_skillsCategoryIds_gin_idx"
  ON "SpecialistSearchProjection" USING GIN ("skillsCategoryIds");
CREATE INDEX "SpecialistSearchProjection_textSearch_trgm_idx"
  ON "SpecialistSearchProjection" USING GIN ("textSearch" gin_trgm_ops);
CREATE INDEX "SpecialistSearchProjection_experienceYears_idx"
  ON "SpecialistSearchProjection"("experienceYears");

CREATE INDEX "JobPosting_organizationId_status_deletedAt_idx"
  ON "JobPosting"("organizationId", "status", "deletedAt");
CREATE INDEX "JobPosting_organizationOfferingId_idx"
  ON "JobPosting"("organizationOfferingId");
CREATE INDEX "JobPosting_serviceCategoryId_idx"
  ON "JobPosting"("serviceCategoryId");
CREATE INDEX "JobPosting_createdByUserId_idx"
  ON "JobPosting"("createdByUserId");

CREATE UNIQUE INDEX "HiringContact_active_organization_specialist_key"
  ON "HiringContact"("organizationId", "specialistId")
  WHERE "isActive" = true AND "deletedAt" IS NULL;
CREATE INDEX "HiringContact_organizationId_status_isActive_deletedAt_idx"
  ON "HiringContact"("organizationId", "status", "isActive", "deletedAt");
CREATE INDEX "HiringContact_specialistId_status_isActive_deletedAt_idx"
  ON "HiringContact"("specialistId", "status", "isActive", "deletedAt");
CREATE INDEX "HiringContact_jobPostingId_idx"
  ON "HiringContact"("jobPostingId");
CREATE INDEX "HiringContact_createdByUserId_idx"
  ON "HiringContact"("createdByUserId");

CREATE UNIQUE INDEX "JobApplication_contactId_key"
  ON "JobApplication"("contactId");
CREATE INDEX "JobApplication_jobPostingId_status_deletedAt_idx"
  ON "JobApplication"("jobPostingId", "status", "deletedAt");
CREATE INDEX "JobApplication_specialistId_status_deletedAt_idx"
  ON "JobApplication"("specialistId", "status", "deletedAt");
CREATE INDEX "JobApplication_createdByUserId_idx"
  ON "JobApplication"("createdByUserId");

CREATE INDEX "OrganizationSpecialistInvitation_organizationId_status_expiresAt_deletedAt_idx"
  ON "OrganizationSpecialistInvitation"("organizationId", "status", "expiresAt", "deletedAt");
CREATE INDEX "OrganizationSpecialistInvitation_specialistId_status_expiresAt_deletedAt_idx"
  ON "OrganizationSpecialistInvitation"("specialistId", "status", "expiresAt", "deletedAt");
CREATE INDEX "OrganizationSpecialistInvitation_createdByUserId_idx"
  ON "OrganizationSpecialistInvitation"("createdByUserId");

ALTER TABLE "SpecialistResume"
  ADD CONSTRAINT "SpecialistResume_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialistResume"
  ADD CONSTRAINT "SpecialistResume_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialistSearchProjection"
  ADD CONSTRAINT "SpecialistSearchProjection_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobPosting"
  ADD CONSTRAINT "JobPosting_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPosting"
  ADD CONSTRAINT "JobPosting_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobPosting"
  ADD CONSTRAINT "JobPosting_organizationOfferingId_fkey"
  FOREIGN KEY ("organizationOfferingId") REFERENCES "OrganizationOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobPosting"
  ADD CONSTRAINT "JobPosting_serviceCategoryId_fkey"
  FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HiringContact"
  ADD CONSTRAINT "HiringContact_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HiringContact"
  ADD CONSTRAINT "HiringContact_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HiringContact"
  ADD CONSTRAINT "HiringContact_jobPostingId_fkey"
  FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HiringContact"
  ADD CONSTRAINT "HiringContact_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "HiringContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_jobPostingId_fkey"
  FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationSpecialistInvitation"
  ADD CONSTRAINT "OrganizationSpecialistInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSpecialistInvitation"
  ADD CONSTRAINT "OrganizationSpecialistInvitation_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSpecialistInvitation"
  ADD CONSTRAINT "OrganizationSpecialistInvitation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
