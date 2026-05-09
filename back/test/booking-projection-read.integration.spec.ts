/**
 * Согласованность {@link resolveBookingProjectionForRead} с полным replay (при `DATABASE_URL`).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { loadBookingTimelineOrdered } from '../src/modules/bookings/domain/booking-journal';
import { projectBookingRowFromTimeline } from '../src/modules/bookings/domain/booking-projection';
import { resolveBookingProjectionForRead } from '../src/modules/bookings/domain/booking-projection-read';

const urlRaw =
  process.env.BOOKING_INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const url = typeof urlRaw === 'string' ? urlRaw.trim() : '';

const describeIntegration = url.length > 0 ? describe : describe.skip;

function projectionKey(p: {
  status: string;
  startsAt: Date;
  endsAt: Date;
  pendingExpiresAt: Date | null;
  cancelReason: string | null;
  cancellationComment: string | null;
}) {
  return JSON.stringify({
    status: p.status,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    pendingExpiresAt: p.pendingExpiresAt?.toISOString() ?? null,
    cancelReason: p.cancelReason,
    cancellationComment: p.cancellationComment,
  });
}

describeIntegration('resolveBookingProjectionForRead (integration)', () => {
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

  it('совпадает с полным replay по журналу', async () => {
    const row = await prisma.booking.findFirst({
      where: { deletedAt: null, events: { some: {} } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (row == null) {
      throw new Error('Нет брони с событиями — seed БД.');
    }
    const timeline = await loadBookingTimelineOrdered(prisma, row.id);
    const full = projectBookingRowFromTimeline(timeline);
    const resolved = await resolveBookingProjectionForRead(prisma, row.id);
    expect(projectionKey(resolved.projection)).toBe(projectionKey(full));
    expect(['materialized_short_circuit', 'full_replay']).toContain(
      resolved.source,
    );
  });
});
