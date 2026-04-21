import { addDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { ListingSlotGroupSeed } from './listing-slot-groups';

const DISPLAY_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Группирует свободные слоты по «сегодня / завтра» в таймзоне витрины (Вьетнам).
 */
export function buildListingSlotGroupsFromSlotStarts(
  startsAtList: Date[],
  now: Date,
): ListingSlotGroupSeed[] {
  const todayKey = formatInTimeZone(now, DISPLAY_TZ, 'yyyy-MM-dd');
  const zonedNow = toZonedTime(now, DISPLAY_TZ);
  const tomorrowKey = formatInTimeZone(
    addDays(zonedNow, 1),
    DISPLAY_TZ,
    'yyyy-MM-dd',
  );

  const todayTimes: string[] = [];
  const tomorrowTimes: string[] = [];

  for (const s of startsAtList) {
    const k = formatInTimeZone(s, DISPLAY_TZ, 'yyyy-MM-dd');
    const label = formatInTimeZone(s, DISPLAY_TZ, 'HH:mm');
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
