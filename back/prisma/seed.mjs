/**
 * Начальные данные: каталог («Массаж» и подкатегории), подписи статусов бронирования (BookingStatusLocale),
 * реклама, демо-специалисты. Идемпотентно (upsert) — безопасно при повторном запуске.
 *
 * Prisma 7: клиент с драйвером pg (как в Nest `PrismaService`).
 */
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { seedAdvertising } from './seed-advertising.mjs';
import { seedBookingStatusLocales } from './seed-booking-status-locale.mjs';
import { seedDemoSpecialists } from './seed-demo-specialists.mjs';
import {
  bodyZoneI18n,
  majorNailI18n,
  majorMassageI18n,
  massageBodyZoneSeeds,
  massageCategorySeeds,
  nailCategorySeeds,
  SUPPORTED_CATALOG_LOCALES,
  serviceCategoryI18n,
} from './seed-catalog-i18n.mjs';

const seedFileDir = dirname(fileURLToPath(import.meta.url));
const backDir = resolve(seedFileDir, '..');
const repoRoot = resolve(backDir, '..');

for (const p of [
  resolve(repoRoot, '.env'),
  resolve(repoRoot, '.env.local'),
  resolve(backDir, '.env'),
  resolve(backDir, '.env.local'),
]) {
  loadEnv({ path: p, override: true });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seed');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{
 *   majorSlug: string;
 *   majorI18n: Record<string, string>;
 *   sortOrder: number;
 *   categorySeeds: Array<{ slug: string; sortOrder: number }>;
 * }} args
 */
async function seedMajorWithCategories(db, args) {
  const major = await db.majorServiceCategory.upsert({
    where: { slug: args.majorSlug },
    create: {
      name: args.majorI18n.en,
      slug: args.majorSlug,
      sortOrder: args.sortOrder,
      isActive: true,
      deletedAt: null,
    },
    update: {
      name: args.majorI18n.en,
      sortOrder: args.sortOrder,
      isActive: true,
      deletedAt: null,
    },
  });

  for (const loc of SUPPORTED_CATALOG_LOCALES) {
    await db.majorServiceCategoryLocale.upsert({
      where: {
        majorServiceCategoryId_locale: {
          majorServiceCategoryId: major.id,
          locale: loc,
        },
      },
      create: {
        majorServiceCategoryId: major.id,
        locale: loc,
        name: args.majorI18n[loc],
      },
      update: {
        name: args.majorI18n[loc],
      },
    });
  }

  const allowedCategorySlugs = new Set(args.categorySeeds.map((row) => row.slug));
  const deprecatedCategories = await db.serviceCategory.findMany({
    where: {
      majorServiceCategoryId: major.id,
      slug: { notIn: [...allowedCategorySlugs] },
      deletedAt: null,
    },
    select: { id: true },
  });
  const deprecatedCategoryIds = deprecatedCategories.map((row) => row.id);
  await db.serviceCategory.updateMany({
    where: {
      id: { in: deprecatedCategoryIds },
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });
  if (deprecatedCategoryIds.length > 0) {
    await db.organizationServiceCategory.deleteMany({
      where: { serviceCategoryId: { in: deprecatedCategoryIds } },
    });
    await db.specialistSkill.deleteMany({
      where: { serviceCategoryId: { in: deprecatedCategoryIds } },
    });
  }

  for (const row of args.categorySeeds) {
    const i18n = serviceCategoryI18n[row.slug];
    if (!i18n) {
      throw new Error(`[seed] Нет переводов для slug=${row.slug}`);
    }
    const en = i18n.en;
    const cat = await db.serviceCategory.upsert({
      where: {
        majorServiceCategoryId_slug: {
          majorServiceCategoryId: major.id,
          slug: row.slug,
        },
      },
      create: {
        majorServiceCategoryId: major.id,
        name: en.name,
        shortName: en.shortName,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: true,
        deletedAt: null,
      },
      update: {
        name: en.name,
        shortName: en.shortName,
        sortOrder: row.sortOrder,
        isActive: true,
        deletedAt: null,
      },
    });

    for (const loc of SUPPORTED_CATALOG_LOCALES) {
      const t = i18n[loc];
      await db.serviceCategoryLocale.upsert({
        where: {
          serviceCategoryId_locale: {
            serviceCategoryId: cat.id,
            locale: loc,
          },
        },
        create: {
          serviceCategoryId: cat.id,
          locale: loc,
          name: t.name,
          shortName: t.shortName,
          description: null,
        },
        update: {
          name: t.name,
          shortName: t.shortName,
          description: null,
        },
      });
    }
  }

  return major;
}

async function main() {
  const massage = await seedMajorWithCategories(prisma, {
    majorSlug: 'massage',
    majorI18n: majorMassageI18n,
    sortOrder: 0,
    categorySeeds: massageCategorySeeds,
  });
  const nail = await seedMajorWithCategories(prisma, {
    majorSlug: 'nail',
    majorI18n: majorNailI18n,
    sortOrder: 1,
    categorySeeds: nailCategorySeeds,
  });

  for (const row of massageBodyZoneSeeds) {
    const i18n = bodyZoneI18n[row.slug];
    if (!i18n) {
      throw new Error(`[seed] Нет переводов body zone для slug=${row.slug}`);
    }
    const en = i18n.en;
    const zone = await prisma.bodyZone.upsert({
      where: {
        majorServiceCategoryId_slug: {
          majorServiceCategoryId: massage.id,
          slug: row.slug,
        },
      },
      create: {
        majorServiceCategoryId: massage.id,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      update: {
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });
    for (const loc of SUPPORTED_CATALOG_LOCALES) {
      await prisma.bodyZoneLocale.upsert({
        where: {
          bodyZoneId_locale: {
            bodyZoneId: zone.id,
            locale: loc,
          },
        },
        create: {
          bodyZoneId: zone.id,
          locale: loc,
          name: i18n[loc].name,
        },
        update: {
          name: i18n[loc].name,
        },
      });
    }
  }

  console.log(
    `[seed] Каталог: «${massage.slug}» (${massage.id}) категорий: ${massageCategorySeeds.length}, «${nail.slug}» (${nail.id}) категорий: ${nailCategorySeeds.length}, зон massage: ${massageBodyZoneSeeds.length}, локали: ${SUPPORTED_CATALOG_LOCALES.join(', ')}.`,
  );

  await seedBookingStatusLocales(prisma);
  await seedAdvertising(prisma);
  await seedDemoSpecialists(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
