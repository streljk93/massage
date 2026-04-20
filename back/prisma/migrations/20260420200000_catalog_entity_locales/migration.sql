-- Локализованные строки для каталога и витрины организаций / услуг (en, vi, ru; новые локали — новые строки).

CREATE TABLE "MajorServiceCategoryLocale" (
    "id" TEXT NOT NULL,
    "majorServiceCategoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MajorServiceCategoryLocale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceCategoryLocale" (
    "id" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategoryLocale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationLocale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationLocale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceLocale" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLocale_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MajorServiceCategoryLocale" ADD CONSTRAINT "MajorServiceCategoryLocale_majorServiceCategoryId_fkey" FOREIGN KEY ("majorServiceCategoryId") REFERENCES "MajorServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceCategoryLocale" ADD CONSTRAINT "ServiceCategoryLocale_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationLocale" ADD CONSTRAINT "OrganizationLocale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceLocale" ADD CONSTRAINT "ServiceLocale_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MajorServiceCategoryLocale_majorServiceCategoryId_locale_key" ON "MajorServiceCategoryLocale"("majorServiceCategoryId", "locale");

CREATE INDEX "MajorServiceCategoryLocale_locale_idx" ON "MajorServiceCategoryLocale"("locale");

CREATE UNIQUE INDEX "ServiceCategoryLocale_serviceCategoryId_locale_key" ON "ServiceCategoryLocale"("serviceCategoryId", "locale");

CREATE INDEX "ServiceCategoryLocale_locale_idx" ON "ServiceCategoryLocale"("locale");

CREATE UNIQUE INDEX "OrganizationLocale_organizationId_locale_key" ON "OrganizationLocale"("organizationId", "locale");

CREATE INDEX "OrganizationLocale_locale_idx" ON "OrganizationLocale"("locale");

CREATE UNIQUE INDEX "ServiceLocale_serviceId_locale_key" ON "ServiceLocale"("serviceId", "locale");

CREATE INDEX "ServiceLocale_locale_idx" ON "ServiceLocale"("locale");

-- Бэкфилл ru из существующих колонок (исторические сиды на русском).
INSERT INTO "MajorServiceCategoryLocale" ("id", "majorServiceCategoryId", "locale", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'ru', m.name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MajorServiceCategory" m
WHERE NOT EXISTS (
    SELECT 1 FROM "MajorServiceCategoryLocale" l
    WHERE l."majorServiceCategoryId" = m.id AND l.locale = 'ru'
);

INSERT INTO "ServiceCategoryLocale" ("id", "serviceCategoryId", "locale", "name", "shortName", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c.id, 'ru', c.name, c."shortName", c.description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ServiceCategory" c
WHERE NOT EXISTS (
    SELECT 1 FROM "ServiceCategoryLocale" l
    WHERE l."serviceCategoryId" = c.id AND l.locale = 'ru'
);
