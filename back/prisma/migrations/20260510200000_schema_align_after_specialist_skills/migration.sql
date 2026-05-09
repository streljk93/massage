-- После удаления таблицы `Service` остаётся неиспользуемый enum `ServiceKind`; индексы и короткие имена ограничений — по текущей `schema.prisma` (лимит идентификаторов 63 символа в PostgreSQL).

DROP TYPE IF EXISTS "ServiceKind";

CREATE INDEX "OfferingPriceOption_organizationOfferingId_durationMinutes_idx" ON "OfferingPriceOption"("organizationOfferingId", "durationMinutes");

CREATE INDEX "OrganizationOffering_organizationId_slug_idx" ON "OrganizationOffering"("organizationId", "slug");

ALTER TABLE "SpecialistOnboardingMajorServiceCategory" RENAME CONSTRAINT "SpecialistOnboardingMajorServiceCategory_majorServiceCategoryId" TO "SpecialistOnboardingMajorServiceCategory_majorServiceCateg_fkey";

ALTER INDEX "SpecialistOnboardingMajorServiceCategory_majorServiceCategoryId" RENAME TO "SpecialistOnboardingMajorServiceCategory_majorServiceCatego_idx";

ALTER INDEX "SpecialistOfferingPriceOverride_specialistOfferingId_offeringPr" RENAME TO "SpecialistOfferingPriceOverride_specialistOfferingId_offeri_key";
