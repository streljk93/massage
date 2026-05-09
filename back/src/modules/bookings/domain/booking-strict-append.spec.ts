import { BadRequestException } from '@nestjs/common';
import { BookingEventType } from '@prisma/client';

import { assertStrictGranularTransitionForAppend } from './booking-strict-append';

describe('assertStrictGranularTransitionForAppend', () => {
  const t1 = new Date('2026-06-01T10:00:00.000Z');
  const t2 = new Date('2026-06-01T11:00:00.000Z');

  it('allows rescheduled on confirmed timeline', () => {
    const prev = [
      {
        type: BookingEventType.created,
        payload: { startsAt: t1.toISOString(), endsAt: t2.toISOString() },
      },
      { type: BookingEventType.confirmed, payload: {} },
    ] as const;
    expect(() =>
      assertStrictGranularTransitionForAppend({
        prevTimeline: [...prev],
        tentativeNewEvent: {
          type: BookingEventType.rescheduled,
          payload: {
            previousStartsAt: t1.toISOString(),
            previousEndsAt: t2.toISOString(),
            nextStartsAt: '2026-06-02T14:00:00.000Z',
            nextEndsAt: '2026-06-02T15:00:00.000Z',
          },
        },
      }),
    ).not.toThrow();
  });

  it('rejects disallowed granular transition', () => {
    const prev = [
      {
        type: BookingEventType.created,
        payload: { startsAt: t1.toISOString(), endsAt: t2.toISOString() },
      },
    ] as const;
    expect(() =>
      assertStrictGranularTransitionForAppend({
        prevTimeline: [...prev],
        tentativeNewEvent: {
          type: BookingEventType.completed,
          payload: {},
        },
      }),
    ).toThrow(BadRequestException);
  });
});
