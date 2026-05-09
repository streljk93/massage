import { projectBookingRowFromTimeline } from './booking-projection';
import {
  BOOKING_PROJECTION_HASH_PREFIX,
  computeBookingProjectionHash,
} from './booking-projection-hash';

describe('computeBookingProjectionHash', () => {
  it('is stable for the same projection tail (v2)', () => {
    const t1 = new Date('2026-06-01T10:00:00.000Z');
    const t2 = new Date('2026-06-01T11:00:00.000Z');
    const p = projectBookingRowFromTimeline([
      {
        type: 'created',
        payload: { startsAt: t1.toISOString(), endsAt: t2.toISOString() },
      },
    ]);
    const a = computeBookingProjectionHash({
      projection: p,
      lastEventId: 'evt-1',
      localSequence: 1,
    });
    const b = computeBookingProjectionHash({
      projection: p,
      lastEventId: 'evt-1',
      localSequence: 1,
    });
    expect(a).toBe(b);
    expect(a.startsWith(`${BOOKING_PROJECTION_HASH_PREFIX}|`)).toBe(true);
  });

  it('changes when tail id differs', () => {
    const t1 = new Date('2026-06-01T10:00:00.000Z');
    const t2 = new Date('2026-06-01T11:00:00.000Z');
    const p = projectBookingRowFromTimeline([
      {
        type: 'created',
        payload: { startsAt: t1.toISOString(), endsAt: t2.toISOString() },
      },
    ]);
    const a = computeBookingProjectionHash({
      projection: p,
      lastEventId: 'evt-a',
      localSequence: 1,
    });
    const b = computeBookingProjectionHash({
      projection: p,
      lastEventId: 'evt-b',
      localSequence: 1,
    });
    expect(a).not.toBe(b);
  });
});
