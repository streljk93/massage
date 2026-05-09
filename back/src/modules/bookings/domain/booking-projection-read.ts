import type { Prisma } from '@prisma/client';

import { loadBookingTimelineOrdered } from './booking-journal';
import {
  cheapTailSequenceMatchesRow,
  tryProjectionHashShortCircuitReadPath,
} from './booking-projection-cursor';
import {
  projectBookingRowFromTimeline,
  type BookingRowProjection,
} from './booking-projection';

export type BookingProjectionReadSource =
  | 'materialized_short_circuit'
  | 'full_replay';

type BookingReadDb = Pick<Prisma.TransactionClient, 'booking' | 'bookingEvent'>;

/**
 * Read-path: при согласованных `lastAppliedSequence`, хвосте журнала и `projectionHash`
 * можно не грузить полный журнал; иначе — lenient replay.
 */
export async function resolveBookingProjectionForRead(
  db: BookingReadDb,
  bookingId: string,
): Promise<{
  projection: BookingRowProjection;
  source: BookingProjectionReadSource;
}> {
  const row = await db.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      pendingExpiresAt: true,
      cancelReason: true,
      cancellationComment: true,
      lastAppliedSequence: true,
      projectionHash: true,
    },
  });
  if (row == null) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  const tail = await db.bookingEvent.findFirst({
    where: { bookingId },
    orderBy: [{ localSequence: 'desc' }, { id: 'desc' }],
    select: { id: true, localSequence: true },
  });

  const fullReplay = async (): Promise<{
    projection: BookingRowProjection;
    source: 'full_replay';
  }> => {
    const timeline = await loadBookingTimelineOrdered(db, bookingId);
    if (timeline.length < 1) {
      throw new Error('booking_events_empty');
    }
    return {
      projection: projectBookingRowFromTimeline(timeline),
      source: 'full_replay',
    };
  };

  if (
    !cheapTailSequenceMatchesRow({
      rowLastAppliedSequence: row.lastAppliedSequence,
      tailEventLocalSequence: tail?.localSequence ?? null,
    }) ||
    tail == null
  ) {
    return fullReplay();
  }

  const projectionFromRow: BookingRowProjection = {
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    pendingExpiresAt: row.pendingExpiresAt,
    cancelReason: row.cancelReason,
    cancellationComment: row.cancellationComment,
  };

  const sc = tryProjectionHashShortCircuitReadPath({
    storedHash: row.projectionHash,
    projection: projectionFromRow,
    lastEventId: tail.id,
    lastLocalSequence: tail.localSequence,
  });

  if (sc.kind === 'hash_ok') {
    return {
      projection: projectionFromRow,
      source: 'materialized_short_circuit',
    };
  }

  return fullReplay();
}
