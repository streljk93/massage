import type { ListingSlotGroupSeed } from './listing-slot-groups';
import {
  dropPastListingSlotGroups,
  normalizeListingSlotTimeLabel,
} from './listing-slot-groups';

const OCCUPIED_KEY = /^(\d{4}-\d{2}-\d{2})\|(\d{1,2}:\d{2})$/;

/**
 * Группирует **занятые** ячейки витрины по дням (ключи `yyyy-MM-dd|HH:mm`).
 * Прошлые дни отбрасываются (как у свободных слотов).
 */
export function buildListingSlotGroupsFromOccupiedKeys(
  occupiedKeys: ReadonlySet<string>,
  now: Date,
): ListingSlotGroupSeed[] {
  const byDay = new Map<string, string[]>();
  for (const k of occupiedKeys) {
    const m = OCCUPIED_KEY.exec(k);
    if (!m) {
      continue;
    }
    const calendarDate = m[1]!;
    const timeRaw = m[2]!;
    const t = normalizeListingSlotTimeLabel(timeRaw);
    const arr = byDay.get(calendarDate) ?? [];
    arr.push(t);
    byDay.set(calendarDate, arr);
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
  return dropPastListingSlotGroups(out, now);
}
