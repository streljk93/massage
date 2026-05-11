import {
  checkListingBookability,
  vnWallClockToUtcDate,
} from './listing-slot-policy';

describe('checkListingBookability', () => {
  it('allows a booking ending at next local midnight when workday ends at 24:00', () => {
    expect(
      checkListingBookability(
        vnWallClockToUtcDate(2026, 5, 10, 23, 0),
        vnWallClockToUtcDate(2026, 5, 11, 0, 0),
        { startMinute: 0, endMinute: 24 * 60 },
      ),
    ).toEqual({ ok: true });
  });

  it('does not treat any other next-day time as the same service day', () => {
    expect(
      checkListingBookability(
        vnWallClockToUtcDate(2026, 5, 10, 23, 0),
        vnWallClockToUtcDate(2026, 5, 11, 0, 30),
        { startMinute: 0, endMinute: 24 * 60 },
      ),
    ).toEqual({ ok: false, code: 'OUTSIDE_WORKDAY' });
  });
});
