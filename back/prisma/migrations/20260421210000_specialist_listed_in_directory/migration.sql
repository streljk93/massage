-- Публичная витрина мастеров: владелец может быть скрыт из поиска, пока не включит «как мастер».
ALTER TABLE "Specialist" ADD COLUMN "listedInDirectory" BOOLEAN NOT NULL DEFAULT true;
