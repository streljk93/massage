-- Назначить роль owner тем employment, где специалист = владелец организации (по ownerUserId).
UPDATE "SpecialistOrganizationEmployment" AS e
SET "role" = 'owner'::"OrganizationMembershipRole"
FROM "Organization" AS o, "Specialist" AS s
WHERE e."organizationId" = o."id"
  AND s."id" = e."specialistId"
  AND o."ownerUserId" IS NOT NULL
  AND s."userId" = o."ownerUserId";

-- В организации не больше одного члена с ролью owner (активные и неактивные строки — см. продуктовые правила).
CREATE UNIQUE INDEX "SpecialistOrganizationEmployment_one_owner_per_organization"
  ON "SpecialistOrganizationEmployment" ("organizationId")
  WHERE "role" = 'owner'::"OrganizationMembershipRole";
