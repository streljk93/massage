import { collectListingGridBucketKeysForBookingInterval } from './listing-slot-grid-keys';
import { vnWallClockToUtcDate } from '../datetime/vn-listing-datetime';

describe('collectListingGridBucketKeysForBookingInterval', () => {
  it('returns multiple buckets when interval crosses local midnight', () => {
    const startsAt = vnWallClockToUtcDate(2026, 6, 1, 23, 30);
    const endsAt = vnWallClockToUtcDate(2026, 6, 2, 1, 0);
    const keys = collectListingGridBucketKeysForBookingInterval(
      startsAt,
      endsAt,
      30,
    );
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys.some((k) => k.startsWith('2026-06-01'))).toBe(true);
    expect(keys.some((k) => k.startsWith('2026-06-02'))).toBe(true);
  });
});
