import { BookingEventType } from '@prisma/client';

import { projectBookingRowFromTimeline } from './booking-projection';
import { BOOKING_STATUS_TRANSITION_MAP } from './booking-status-transitions';

/** Интеграция редуктора проекции с продуктовой таблицей переходов (маппинг «до/после» по статусу). */
describe('BookingStatusTransitionMap vs projection', () => {
  const t0 = new Date('2026-06-01T10:00:00.000Z');
  const t1 = new Date('2026-06-01T11:00:00.000Z');

  it('pending -> confirmed matches allowed targets', () => {
    const before = projectBookingRowFromTimeline([
      {
        type: 'created',
        payload: { startsAt: t0.toISOString(), endsAt: t1.toISOString() },
      },
    ]);
    const after = projectBookingRowFromTimeline([
      { type: 'created', payload: { startsAt: t0.toISOString(), endsAt: t1.toISOString() } },
      { type: BookingEventType.confirmed, payload: {} },
    ]);
    expect(BOOKING_STATUS_TRANSITION_MAP[before.status]).toContain(after.status);
  });
});
