import { formatListingCalendarYmd } from '../../../common/datetime/vn-listing-datetime';

export type ListingSlotGroupSeed = {
  /** Календарная дата витрины, yyyy-MM-dd (Asia/Ho_Chi_Minh). */
  calendarDate: string;
  times: string[];
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Единый вид `HH:mm` для ключей занятости и времени в JSON (`9:00` → `09:00`). */
export function normalizeListingSlotTimeLabel(raw: string): string {
  const parts = raw.trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return raw.trim();
  }
  return `${pad2(h)}:${pad2(m)}`;
}

/** Убирает дни строго до «сегодня» в таймзоне витрины. */
export function dropPastListingSlotGroups(
  groups: ListingSlotGroupSeed[],
  now: Date,
): ListingSlotGroupSeed[] {
  const minDate = formatListingCalendarYmd(now);
  return groups.filter((g) => g.calendarDate >= minDate);
}
