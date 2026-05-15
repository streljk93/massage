import { addDays } from "date-fns";
import {
  formatListingCalendarYmd,
  formatListingOccupiedSlotKey,
  vnWallClockToUtcDate,
} from "@/shared/lib/datetime/vn-listing-datetime";

/** Как `SLOT_GRID_MINUTES` на бэкенде (`listing-slot-policy`). */
const SLOT_GRID_MINUTES = 30;

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

function slotInstantsForListingDay(dayKey: string): Date[] {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const lastStartMin = 24 * 60 - SLOT_GRID_MINUTES;
  const out: Date[] = [];
  for (let m = 0; m <= lastStartMin; m += SLOT_GRID_MINUTES) {
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
    for (const S of slotInstantsForListingDay(dayKey)) {
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

export function specialistAvailableCoversProposed(
  availableListingSlotKeys: readonly string[] | undefined,
  proposedKeys: Set<string>,
): boolean {
  if (!availableListingSlotKeys?.length || proposedKeys.size === 0) {
    return false;
  }
  const available = new Set(availableListingSlotKeys);
  for (const k of proposedKeys) {
    if (!available.has(k)) {
      return false;
    }
  }
  return true;
}
