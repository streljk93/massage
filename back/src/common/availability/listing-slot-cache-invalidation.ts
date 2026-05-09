import { collectListingGridBucketKeysForBookingInterval } from './listing-slot-grid-keys';

export type ListingSlotIntervalUtc = { startsAt: Date; endsAt: Date };

/**
 * Ключи для будущей инвалидации кэша витрины: все grid-bucket'ы и множество календарных дат (VN yyyy-MM-dd из ключей слота).
 */
export function collectListingSlotInvalidationSurface(args: {
  intervals: ListingSlotIntervalUtc[];
}): { gridKeys: string[]; calendarYmds: string[] } {
  const grid = new Set<string>();
  for (const iv of args.intervals) {
    for (const k of collectListingGridBucketKeysForBookingInterval(
      iv.startsAt,
      iv.endsAt,
    )) {
      grid.add(k);
    }
  }
  const ymds = new Set<string>();
  for (const k of grid) {
    const y = k.split('|')[0];
    if (y != null && y.length > 0) {
      ymds.add(y);
    }
  }
  return {
    gridKeys: [...grid].sort(),
    calendarYmds: [...ymds].sort(),
  };
}
