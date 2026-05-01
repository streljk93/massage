-- Глобальная роль учётной записи: «master» — суперадмин (доступ к /admin модерации и т.д.).

CREATE TYPE "PlatformRole" AS ENUM ('standard', 'master');

ALTER TABLE "User"
  ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'standard';
