import { addDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { ListingSlotGroupSeed } from './listing-slot-groups';

import { LISTING_DISPLAY_TZ } from '../../../common/availability/listing-slot-policy';

/**
 * Убирает из витринных групп слотов времена, для которых уже есть активное бронирование
 * (совпадение по дате в таймзоне витрины + `HH:mm`).
 */
export function filterSlotGroupsByOccupiedKeys(
  slotGroups: ListingSlotGroupSeed[],
  occupiedKeys: Set<string>,
  now: Date,
): ListingSlotGroupSeed[] {
  if (occupiedKeys.size === 0) {
    return slotGroups;
  }
  const todayKey = formatInTimeZone(now, LISTING_DISPLAY_TZ, 'yyyy-MM-dd');
  const zonedNow = toZonedTime(now, LISTING_DISPLAY_TZ);
  const tomorrowKey = formatInTimeZone(
    addDays(zonedNow, 1),
    LISTING_DISPLAY_TZ,
    'yyyy-MM-dd',
  );

  const out: ListingSlotGroupSeed[] = [];
  for (const g of slotGroups) {
    const dayKey = g.dayKey === 'today' ? todayKey : tomorrowKey;
    const times = g.times.filter((t) => !occupiedKeys.has(`${dayKey}|${t}`));
    if (times.length > 0) {
      out.push({ dayKey: g.dayKey, times });
    }
  }
  return out;
}
