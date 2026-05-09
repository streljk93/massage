/**
 * Два соединения: первое держит `pg_advisory_xact_lock` на ключе слота мастера,
 * второе с коротким `lock_timeout` получает отказ. Нужен Postgres (`DATABASE_URL`).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { specialistListingSlotAdvisoryLockKeys } from '../src/modules/bookings/domain/booking-advisory-lock';
import { isPostgresLockTimeoutError } from '../src/modules/bookings/domain/booking-db-errors';

const urlRaw =
  process.env.BOOKING_INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const url = typeof urlRaw === 'string' ? urlRaw.trim() : '';

const describeIntegration = url.length > 0 ? describe : describe.skip;

describeIntegration('Booking advisory lock (integration)', () => {
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('второе соединение получает lock_timeout, пока первое держит парный advisory xact lock', async () => {
    const spec = await prisma.specialist.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (spec == null) {
      throw new Error('Нет specialist в БД — выполните seed.');
    }
    const keys = specialistListingSlotAdvisoryLockKeys(spec.id);

    const holderPromise = prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('lock_timeout', '30000', true)`,
        );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${keys[0]}::int4, ${keys[1]}::int4)`;
        await tx.$executeRaw`SELECT pg_sleep(2.5)`;
      },
      { timeout: 60_000 },
    );

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 200);
    });

    let waiterErr: unknown;
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('lock_timeout', '800', true)`,
          );
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${keys[0]}::int4, ${keys[1]}::int4)`;
        },
        { timeout: 60_000 },
      );
    } catch (e: unknown) {
      waiterErr = e;
    }

    await holderPromise;

    expect(isPostgresLockTimeoutError(waiterErr)).toBe(true);
  });
});
