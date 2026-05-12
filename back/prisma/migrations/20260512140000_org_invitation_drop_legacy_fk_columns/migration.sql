-- Приглашение в команду больше не связано с HiringContact / вакансией.
-- Локальные БД могли остаться со старыми NOT NULL колонками после смены схемы без миграции.

ALTER TABLE "OrganizationSpecialistInvitation" DROP CONSTRAINT IF EXISTS "OrganizationSpecialistInvitation_contactId_fkey";
ALTER TABLE "OrganizationSpecialistInvitation" DROP CONSTRAINT IF EXISTS "OrganizationSpecialistInvitation_jobPostingId_fkey";
ALTER TABLE "OrganizationSpecialistInvitation" DROP CONSTRAINT IF EXISTS "OrganizationSpecialistInvitation_organizationOfferingId_fkey";

ALTER TABLE "OrganizationSpecialistInvitation" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "OrganizationSpecialistInvitation" DROP COLUMN IF EXISTS "jobPostingId";
ALTER TABLE "OrganizationSpecialistInvitation" DROP COLUMN IF EXISTS "organizationOfferingId";
