import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const backDir = resolve(scriptsDir, "..");
const repoRoot = resolve(backDir, "..");

for (const p of [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, ".env.local"),
  resolve(backDir, ".env"),
  resolve(backDir, ".env.local"),
]) {
  loadEnv({ path: p, override: true });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const massage = await prisma.majorServiceCategory.findFirst({
    where: { slug: "massage", deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!massage) {
    throw new Error("Major category 'massage' not found");
  }

  const orgsWithoutMajors = await prisma.organization.findMany({
    where: {
      deletedAt: null,
      majorServiceCategories: { none: {} },
    },
    select: { id: true },
  });

  if (orgsWithoutMajors.length > 0) {
    await prisma.organizationMajorServiceCategory.createMany({
      data: orgsWithoutMajors.map((o) => ({
        organizationId: o.id,
        majorServiceCategoryId: massage.id,
      })),
      skipDuplicates: true,
    });
  }

  const staleLinks = await prisma.organizationMajorServiceCategory.findMany({
    where: {
      organization: { deletedAt: null },
      majorServiceCategory: { deletedAt: null, isActive: false },
    },
    select: { organizationId: true, majorServiceCategoryId: true },
  });
  if (staleLinks.length > 0) {
    await prisma.organizationMajorServiceCategory.deleteMany({
      where: {
        OR: staleLinks.map((row) => ({
          organizationId: row.organizationId,
          majorServiceCategoryId: row.majorServiceCategoryId,
        })),
      },
    });
  }

  console.log(
    `[backfill-major-categories] massage link added for orgs without majors: ${orgsWithoutMajors.length}, stale links removed: ${staleLinks.length}`,
  );
}

main()
  .catch((error) => {
    console.error("[backfill-major-categories] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
