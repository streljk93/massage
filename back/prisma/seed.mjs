/**
 * Начальные данные каталога: большая категория «Массаж» и подкатегории + строки локалей (en, vi, ru).
 * Идемпотентно (upsert) — безопасно при повторном запуске.
 *
 * Prisma 7: клиент с драйвером pg (как в Nest `PrismaService`).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { seedAdvertising } from "./seed-advertising.mjs";
import { seedDemoSpecialists } from "./seed-demo-specialists.mjs";
import {
  majorMassageI18n,
  massageCategorySeeds,
  SUPPORTED_CATALOG_LOCALES,
  serviceCategoryI18n,
} from "./seed-catalog-i18n.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seed");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const massage = await prisma.majorServiceCategory.upsert({
    where: { slug: "massage" },
    create: {
      name: majorMassageI18n.en,
      slug: "massage",
      sortOrder: 0,
      isActive: true,
    },
    update: {
      name: majorMassageI18n.en,
      isActive: true,
    },
  });

  for (const loc of SUPPORTED_CATALOG_LOCALES) {
    await prisma.majorServiceCategoryLocale.upsert({
      where: {
        majorServiceCategoryId_locale: {
          majorServiceCategoryId: massage.id,
          locale: loc,
        },
      },
      create: {
        majorServiceCategoryId: massage.id,
        locale: loc,
        name: majorMassageI18n[loc],
      },
      update: {
        name: majorMassageI18n[loc],
      },
    });
  }

  for (const row of massageCategorySeeds) {
    const i18n = serviceCategoryI18n[row.slug];
    if (!i18n) {
      throw new Error(`[seed] Нет переводов для slug=${row.slug}`);
    }
    const en = i18n.en;

    const cat = await prisma.serviceCategory.upsert({
      where: {
        majorServiceCategoryId_slug: {
          majorServiceCategoryId: massage.id,
          slug: row.slug,
        },
      },
      create: {
        majorServiceCategoryId: massage.id,
        name: en.name,
        shortName: en.shortName,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      update: {
        name: en.name,
        shortName: en.shortName,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });

    for (const loc of SUPPORTED_CATALOG_LOCALES) {
      const t = i18n[loc];
      await prisma.serviceCategoryLocale.upsert({
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

  console.log(
    `[seed] Каталог: «${massage.slug}» (${massage.id}), подкатегорий: ${massageCategorySeeds.length}, локали: ${SUPPORTED_CATALOG_LOCALES.join(", ")}.`,
  );

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
