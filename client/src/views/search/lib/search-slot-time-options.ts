import { addDays } from "date-fns";
import {
  formatListingCalendarYmd,
  vnWallClockToUtcDate,
} from "@/shared/lib/datetime/vn-listing-datetime";
import { UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS } from "@/shared/lib/directory-free-slot-groups-from-occupied";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Дни превью витрины (с сегодня, Asia/Ho_Chi_Minh). */
export function buildSearchSlotDayOptions(
  now: Date,
  formatLabel: (calendarDateYmd: string) => string,
): { value: string; label: string }[] {
  const todayKey = formatListingCalendarYmd(now);
  const [y, m, d] = todayKey.split("-").map(Number);
  const start = vnWallClockToUtcDate(y, m, d, 0, 0);
  const n = Math.max(
    1,
    Math.min(90, Math.floor(UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS)),
  );
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const v = formatListingCalendarYmd(addDays(start, i));
    out.push({ value: v, label: formatLabel(v) });
  }
  return out;
}

/**
 * С 7:00 до 23:30 с шагом 30 мин — покрывает сиды/настройки салонов.
 */
export function buildSearchSlotTimeOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let mins = 7 * 60; mins <= 23 * 60 + 30; mins += 30) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const v = `${pad2(hh)}:${pad2(mm)}`;
    out.push({ value: v, label: v });
  }
  return out;
}
