-- Личный каталог мастера (Service + цены/зоны) удалён; навыки — только SpecialistSkill (бывш. SpecialistServiceCategory).

DROP TABLE IF EXISTS "ServiceBodyZone" CASCADE;
DROP TABLE IF EXISTS "ServiceComboItem" CASCADE;
DROP TABLE IF EXISTS "ServicePriceOption" CASCADE;
DROP TABLE IF EXISTS "Service" CASCADE;

ALTER TABLE "SpecialistServiceCategory" RENAME TO "SpecialistSkill";
ALTER INDEX "SpecialistServiceCategory_serviceCategoryId_idx" RENAME TO "SpecialistSkill_serviceCategoryId_idx";
ALTER TABLE "SpecialistSkill" RENAME CONSTRAINT "SpecialistServiceCategory_pkey" TO "SpecialistSkill_pkey";
ALTER TABLE "SpecialistSkill" RENAME CONSTRAINT "SpecialistServiceCategory_specialistId_fkey" TO "SpecialistSkill_specialistId_fkey";
ALTER TABLE "SpecialistSkill" RENAME CONSTRAINT "SpecialistServiceCategory_serviceCategoryId_fkey" TO "SpecialistSkill_serviceCategoryId_fkey";
