import { formatInTimeZone } from 'date-fns-tz';
import type { ListingSlotGroupSeed } from './listing-slot-groups';

import { LISTING_DISPLAY_TZ } from '../../../common/availability/listing-slot-policy';

/**
 * Группирует свободные слоты по календарным дням витрины (Asia/Ho_Chi_Minh).
 */
export function buildListingSlotGroupsFromSlotStarts(
  startsAtList: Date[],
  _now: Date,
): ListingSlotGroupSeed[] {
  const byDay = new Map<string, string[]>();
  for (const s of startsAtList) {
    const k = formatInTimeZone(s, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
    const label = formatInTimeZone(s, LISTING_DISPLAY_TZ, 'HH:mm');
    const arr = byDay.get(k) ?? [];
    arr.push(label);
    byDay.set(k, arr);
  }

  const dates = [...byDay.keys()].sort();
  const out: ListingSlotGroupSeed[] = [];
  for (const calendarDate of dates) {
    const times = [...new Set(byDay.get(calendarDate) ?? [])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (times.length > 0) {
      out.push({ calendarDate, times });
    }
  }
  return out;
}
