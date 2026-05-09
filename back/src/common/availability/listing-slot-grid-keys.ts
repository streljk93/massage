import { addMinutes, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import {
  LISTING_DISPLAY_TZ,
  formatListingOccupiedSlotKey,
  vnWallClockToUtcDate,
} from '../datetime/vn-listing-datetime';

import { SLOT_GRID_MINUTES } from './listing-slot-policy';

/**
 * Округление вниз к началу слота сетки витрины (Asia/Ho_Chi_Minh) — UTC-момент начала слота.
 */
function alignUtcStartDownToListingGrid(
  instant: Date,
  gridMinutes: number,
): Date {
  const z = toZonedTime(instant, LISTING_DISPLAY_TZ);
  const minuteOfDay = z.getHours() * 60 + z.getMinutes();
  const aligned = Math.floor(minuteOfDay / gridMinutes) * gridMinutes;
  const h = Math.floor(aligned / 60);
  const m = aligned % 60;
  return vnWallClockToUtcDate(
    z.getFullYear(),
    z.getMonth() + 1,
    z.getDate(),
    h,
    m,
  );
}

/**
 * Все ключи сетки `yyyy-MM-dd|HH:mm` (витрина), пересекающиеся с [startsAt, endsAt).
 * Для будущей инвалидации кэша слотов — не только «день», но и каждый 30‑мин bucket на границе полуночи.
 */
export function collectListingGridBucketKeysForBookingInterval(
  startsAt: Date,
  endsAt: Date,
  gridMinutes: number = SLOT_GRID_MINUTES,
): string[] {
  const keys = new Set<string>();
  let cursor = alignUtcStartDownToListingGrid(startsAt, gridMinutes);
  const guard = 4096;
  let n = 0;
  while (isBefore(cursor, endsAt) && n < guard) {
    keys.add(formatListingOccupiedSlotKey(cursor));
    cursor = addMinutes(cursor, gridMinutes);
    n += 1;
  }
  return [...keys].sort();
}
