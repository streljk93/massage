-- Предмодерация витринных полей профиля мастера (`Specialist`): кейс `specialist_profile`, subjectId = specialist.id.

ALTER TYPE "ContentModerationCaseKind" ADD VALUE IF NOT EXISTS 'specialist_profile';

ALTER TABLE "Specialist"
  ADD COLUMN "profilePublicationModerationStatus" "PublicationModerationStatus" NOT NULL DEFAULT 'approved',
  ADD COLUMN "catalogListedBio" TEXT,
  ADD COLUMN "catalogListedExperienceYears" INTEGER,
  ADD COLUMN "catalogListedImageUrl" TEXT,
  ADD COLUMN "catalogListedImageAlt" TEXT;
