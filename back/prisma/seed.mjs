/**
 * Начальные данные каталога: большая категория «Массаж» и подкатегории.
 * Идемпотентно (upsert) — безопасно при повторном запуске.
 *
 * Prisma 7: клиент с драйвером pg (как в Nest `PrismaService`).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seed");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Подкатегории массажа: полное имя, короткое имя (шея / тело / …), slug внутри большой категории. */
const massageCategories = [
  { name: "Массаж шеи и зоны декольте", shortName: "шея", slug: "neck", sortOrder: 0 },
  { name: "Массаж тела (общий)", shortName: "тело", slug: "body", sortOrder: 1 },
  { name: "Массаж ног и стоп", shortName: "ноги", slug: "legs", sortOrder: 2 },
  { name: "СПА-программы и ритуалы", shortName: "спа", slug: "spa", sortOrder: 3 },
  { name: "Массаж спины", shortName: "спина", slug: "back", sortOrder: 4 },
  { name: "Массаж рук и кистей", shortName: "руки", slug: "arms", sortOrder: 5 },
  { name: "Лицевой массаж", shortName: "лицо", slug: "face", sortOrder: 6 },
  { name: "Расслабляющий массаж", shortName: "релакс", slug: "relaxing", sortOrder: 7 },
  { name: "Спортивный массаж", shortName: "спорт", slug: "sports", sortOrder: 8 },
  { name: "Головной массаж", shortName: "голова", slug: "head", sortOrder: 9 },
  { name: "Лимфодренажный массаж", shortName: "лимфа", slug: "lymphatic", sortOrder: 10 },
  { name: "Тайский массаж", shortName: "тайский", slug: "thai", sortOrder: 11 },
  { name: "Массаж горячими камнями", shortName: "стоун", slug: "hot-stone", sortOrder: 12 },
  { name: "Антицеллюлитный массаж", shortName: "антицеллюлит", slug: "anti-cellulite", sortOrder: 13 },
  { name: "Медовый массаж", shortName: "медовый", slug: "honey", sortOrder: 14 },
  { name: "Массаж стоп (рефлексология)", shortName: "стопы", slug: "feet-reflexology", sortOrder: 15 },
  { name: "Прессотерапия", shortName: "прессо", slug: "pressotherapy", sortOrder: 16 },
  { name: "Массаж для беременных", shortName: "беременность", slug: "pregnancy", sortOrder: 17 },
  { name: "Аромамассаж", shortName: "арома", slug: "aroma", sortOrder: 18 },
  { name: "Классический массаж", shortName: "классика", slug: "classic", sortOrder: 19 },
];

async function main() {
  const massage = await prisma.majorServiceCategory.upsert({
    where: { slug: "massage" },
    create: {
      name: "Массаж",
      slug: "massage",
      sortOrder: 0,
      isActive: true,
    },
    update: {
      name: "Массаж",
      isActive: true,
    },
  });

  for (const row of massageCategories) {
    await prisma.serviceCategory.upsert({
      where: {
        majorServiceCategoryId_slug: {
          majorServiceCategoryId: massage.id,
          slug: row.slug,
        },
      },
      create: {
        majorServiceCategoryId: massage.id,
        name: row.name,
        shortName: row.shortName,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      update: {
        name: row.name,
        shortName: row.shortName,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(
    `[seed] Каталог: большая категория «${massage.name}» (${massage.id}), подкатегорий: ${massageCategories.length}.`,
  );
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
