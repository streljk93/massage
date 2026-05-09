import type { Prisma } from '@prisma/client';

import { computeBookingProjectionHash } from './booking-projection-hash';
import type { BookingRowProjection } from './booking-projection';

/** Единственный канонический OLTP-путь записи спроецированных полей строки `Booking` (+ version CAS). */
export type CommitProjectedBookingRowArgs = {
  bookingId: string;
  expectedVersion: number;
  projection: BookingRowProjection;
  lastEventId: string;
  lastLocalSequence: number;
};

/**
 * CAS по `version`; инкремент версии и обновление `projectionHash` после replay журнала.
 * Вызывать только из {@link BookingAppendService} или {@link BookingReconcileService}.
 */
export async function commitProjectedBookingRow(
  tx: Prisma.TransactionClient,
  args: CommitProjectedBookingRowArgs,
): Promise<{ count: number }> {
  const projectionHash = computeBookingProjectionHash({
    projection: args.projection,
    lastEventId: args.lastEventId,
    localSequence: args.lastLocalSequence,
  });
  return tx.booking.updateMany({
    where: { id: args.bookingId, version: args.expectedVersion },
    data: {
      status: args.projection.status,
      startsAt: args.projection.startsAt,
      endsAt: args.projection.endsAt,
      pendingExpiresAt: args.projection.pendingExpiresAt,
      cancelReason: args.projection.cancelReason,
      cancellationComment: args.projection.cancellationComment,
      version: { increment: 1 },
      lastAppliedSequence: args.lastLocalSequence,
      projectionHash,
    },
  });
}
