import {
  materializedBookingMatchesProjectedRow,
  projectBookingRowFromTimeline,
} from './booking-projection';

describe('projectBookingRowFromTimeline', () => {
  it('keeps confirmed and moves slot after rescheduled', () => {
    const t1 = new Date('2026-06-01T10:00:00.000Z');
    const t2 = new Date('2026-06-01T11:00:00.000Z');
    const t3 = new Date('2026-06-02T14:00:00.000Z');
    const t4 = new Date('2026-06-02T15:00:00.000Z');
    const row = projectBookingRowFromTimeline([
      {
        type: 'created',
        payload: { startsAt: t1, endsAt: t2 },
      },
      { type: 'confirmed', payload: {} },
      {
        type: 'rescheduled',
        payload: {
          previousStartsAt: t1.toISOString(),
          previousEndsAt: t2.toISOString(),
          nextStartsAt: t3.toISOString(),
          nextEndsAt: t4.toISOString(),
        },
      },
    ]);
    expect(row.status).toBe('confirmed');
    expect(row.startsAt.getTime()).toBe(t3.getTime());
    expect(row.endsAt.getTime()).toBe(t4.getTime());
  });

  it('materializedBookingMatchesProjectedRow detects drift', () => {
    const t1 = new Date('2026-06-01T10:00:00.000Z');
    const t2 = new Date('2026-06-01T11:00:00.000Z');
    const projected = projectBookingRowFromTimeline([
      { type: 'created', payload: { startsAt: t1, endsAt: t2 } },
    ]);
    expect(
      materializedBookingMatchesProjectedRow({ ...projected }, projected),
    ).toBe(true);
    expect(
      materializedBookingMatchesProjectedRow(
        {
          ...projected,
          status: 'confirmed' as typeof projected.status,
        },
        projected,
      ),
    ).toBe(false);
  });
});
