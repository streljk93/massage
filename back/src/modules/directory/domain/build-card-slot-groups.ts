import { addDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { ListingSlotGroupSeed } from './listing-slot-groups';

import { LISTING_DISPLAY_TZ } from '../../../common/availability/listing-slot-policy';

/**
 * Группирует свободные слоты по «сегодня / завтра» в таймзоне витрины (Вьетнам).
 */
export function buildListingSlotGroupsFromSlotStarts(
  startsAtList: Date[],
  now: Date,
): ListingSlotGroupSeed[] {
  const todayKey = formatInTimeZone(now, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
  const zonedNow = toZonedTime(now, LISTING_DISPLAY_TZ);
  const tomorrowKey = formatInTimeZone(
    addDays(zonedNow, 1),
    LISTING_DISPLAY_TZ,
    'yyyy-MM-dd',
  );

  const todayTimes: string[] = [];
  const tomorrowTimes: string[] = [];

  for (const s of startsAtList) {
    const k = formatInTimeZone(s, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
    const label = formatInTimeZone(s, LISTING_DISPLAY_TZ, 'HH:mm');
    if (k === todayKey) {
      todayTimes.push(label);
    } else if (k === tomorrowKey) {
      tomorrowTimes.push(label);
    }
  }

  const out: ListingSlotGroupSeed[] = [];
  if (todayTimes.length > 0) {
    out.push({ dayKey: 'today', times: todayTimes });
  }
  if (tomorrowTimes.length > 0) {
    out.push({ dayKey: 'tomorrow', times: tomorrowTimes });
  }
  return out;
}
