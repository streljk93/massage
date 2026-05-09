import type { Prisma } from '@prisma/client';

import type { BookingTimelineEvent } from './booking-projection';

/** Журнал для проекции: строго `localSequence`, затем `id`. */
export async function loadBookingTimelineOrdered(
  db: Pick<Prisma.TransactionClient, 'bookingEvent'>,
  bookingId: string,
): Promise<BookingTimelineEvent[]> {
  const rows = await db.bookingEvent.findMany({
    where: { bookingId },
    orderBy: [{ localSequence: 'asc' }, { id: 'asc' }],
    select: { type: true, payload: true },
  });
  return rows.map((r) => ({ type: r.type, payload: r.payload }));
}
