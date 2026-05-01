-- Имя мастера на витрине отдельно от `User.name`; заморозка имени при правках профиля под модерацию.
-- Опыт и alt аватара не замораживаем и не входят в предмодерацию профиля.

ALTER TABLE "Specialist"
  ADD COLUMN "listingName" TEXT,
  ADD COLUMN "catalogListedListingName" TEXT;

UPDATE "Specialist" s
SET "listingName" = u."name"
FROM "User" u
WHERE u.id = s."userId"
  AND ("listingName" IS NULL OR trim(COALESCE("listingName", '')) = '');

ALTER TABLE "Specialist"
  DROP COLUMN IF EXISTS "catalogListedExperienceYears",
  DROP COLUMN IF EXISTS "catalogListedImageAlt";
