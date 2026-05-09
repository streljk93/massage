import { collectListingSlotInvalidationSurface } from './listing-slot-cache-invalidation';
import { vnWallClockToUtcDate } from '../datetime/vn-listing-datetime';

describe('collectListingSlotInvalidationSurface', () => {
  it('merges grid keys and calendar ymds across intervals', () => {
    const a = vnWallClockToUtcDate(2026, 6, 1, 23, 30);
    const b = vnWallClockToUtcDate(2026, 6, 2, 1, 0);
    const { gridKeys, calendarYmds } = collectListingSlotInvalidationSurface({
      intervals: [{ startsAt: a, endsAt: b }],
    });
    expect(gridKeys.length).toBeGreaterThanOrEqual(2);
    expect(calendarYmds).toContain('2026-06-01');
    expect(calendarYmds).toContain('2026-06-02');
  });
});
