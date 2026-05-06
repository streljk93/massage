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

  const orgsPatched = await prisma.organization.updateMany({
    where: {
      deletedAt: null,
      primaryMajorServiceCategoryId: null,
    },
    data: {
      primaryMajorServiceCategoryId: massage.id,
    },
  });

  const staleAdditional = await prisma.organizationAdditionalMajorCategory.findMany({
    where: {
      organization: { deletedAt: null },
      majorServiceCategory: { deletedAt: null, isActive: false },
    },
    select: { organizationId: true, majorServiceCategoryId: true },
  });
  if (staleAdditional.length > 0) {
    await prisma.organizationAdditionalMajorCategory.deleteMany({
      where: {
        OR: staleAdditional.map((row) => ({
          organizationId: row.organizationId,
          majorServiceCategoryId: row.majorServiceCategoryId,
        })),
      },
    });
  }

  console.log(
    `[backfill-major-categories] primary patched: ${orgsPatched.count}, stale additional removed: ${staleAdditional.length}`,
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
