import { addDays } from "date-fns";
import {
  formatListingCalendarYmd,
  formatListingOccupiedSlotKey,
  vnWallClockToUtcDate,
} from "@/shared/lib/datetime/vn-listing-datetime";

/** Как `SLOT_GRID_MINUTES` и рабочий день на бэкенде (`listing-slot-policy`). */
const SLOT_GRID_MINUTES = 30;

const DEFAULT_WORKDAY = {
  startHour: 8,
  startMinute: 0,
  endHour: 22,
} as const;

function collectDayKeysOverlapping(startsAt: Date, endsAt: Date): string[] {
  const dayKeys: string[] = [];
  const seen = new Set<string>();
  let cursor = startsAt.getTime();
  const endMs = endsAt.getTime();
  while (cursor < endMs) {
    const dk = formatListingCalendarYmd(new Date(cursor));
    if (!seen.has(dk)) {
      seen.add(dk);
      dayKeys.push(dk);
    }
    const [y, mo, d] = dk.split("-").map(Number);
    cursor = addDays(vnWallClockToUtcDate(y, mo, d, 0, 0), 1).getTime();
  }
  return dayKeys;
}

function slotInstantsForWorkday(dayKey: string): Date[] {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const dayStartMin =
    DEFAULT_WORKDAY.startHour * 60 + DEFAULT_WORKDAY.startMinute;
  const lastStartMin = DEFAULT_WORKDAY.endHour * 60 - SLOT_GRID_MINUTES;
  const out: Date[] = [];
  for (let m = dayStartMin; m <= lastStartMin; m += SLOT_GRID_MINUTES) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    out.push(vnWallClockToUtcDate(y, mo, d, hh, mm));
  }
  return out;
}

/**
 * Ключи ячеек сетки 30 мин, пересекающиеся с [startsAt, endsAt) — как
 * `expandIntervalToOccupiedSlotKeys` на бэкенде.
 */
export function expandIntervalToListingOccupiedSlotKeys(
  startsAt: Date,
  endsAt: Date,
): Set<string> {
  const keys = new Set<string>();
  if (endsAt.getTime() <= startsAt.getTime()) {
    return keys;
  }
  for (const dayKey of collectDayKeysOverlapping(startsAt, endsAt)) {
    for (const S of slotInstantsForWorkday(dayKey)) {
      const slotEnd = S.getTime() + SLOT_GRID_MINUTES * 60_000;
      if (S.getTime() < endsAt.getTime() && slotEnd > startsAt.getTime()) {
        keys.add(formatListingOccupiedSlotKey(S));
      }
    }
  }
  return keys;
}

export function specialistOccupiedOverlapsProposed(
  occupiedListingSlotKeys: readonly string[] | undefined,
  proposedKeys: Set<string>,
): boolean {
  if (!occupiedListingSlotKeys?.length || proposedKeys.size === 0) {
    return false;
  }
  const occ = new Set(occupiedListingSlotKeys);
  for (const k of proposedKeys) {
    if (occ.has(k)) {
      return true;
    }
  }
  return false;
}
