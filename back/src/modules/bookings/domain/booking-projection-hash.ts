import { createHash } from 'node:crypto';

import type { BookingRowProjection } from './booking-projection';

/**
 * Единственный поддерживаемый формат `Booking.projectionHash`: sha256 от канонического JSON
 * (`hashAlgo`, `entity`, `schemaVersion`, поля проекции, хвост журнала).
 */
export const BOOKING_PROJECTION_HASH_PREFIX = 'sha256|booking_projection|v2';

export function computeBookingProjectionHash(args: {
  projection: BookingRowProjection;
  lastEventId: string;
  localSequence: number;
}): string {
  const canonical = {
    hashAlgo: 'sha256' as const,
    entity: 'BookingProjection' as const,
    schemaVersion: 1,
    status: args.projection.status,
    startsAt: args.projection.startsAt.toISOString(),
    endsAt: args.projection.endsAt.toISOString(),
    pendingExpiresAt: args.projection.pendingExpiresAt?.toISOString() ?? null,
    cancelReason: args.projection.cancelReason,
    cancellationComment: args.projection.cancellationComment,
    lastEventId: args.lastEventId,
    localSequence: args.localSequence,
  };
  const h = createHash('sha256')
    .update(JSON.stringify(canonical), 'utf8')
    .digest('hex');
  return `${BOOKING_PROJECTION_HASH_PREFIX}|${h}`;
}
