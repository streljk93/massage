import { addDays } from "date-fns";
import {
  formatListingCalendarYmd,
  LISTING_DISPLAY_TZ,
  vnNoonUtcForCalendarYmd,
} from "@/shared/lib/datetime/vn-listing-datetime";
import { DAY_END_HOUR, DAY_START_HOUR } from "../model/constants";

export function getWeekDays(dayKey: string): string[] {
  const noon = vnNoonUtcForCalendarYmd(dayKey);
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: LISTING_DISPLAY_TZ,
    weekday: "short",
  }).format(noon);
  const dow: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const d = dow[short] ?? 1;
  const fromMon = d === 0 ? 6 : d - 1;
  return Array.from({ length: 7 }, (_, i) =>
    formatListingCalendarYmd(addDays(noon, -fromMon + i)),
  );
}

export function getMonthGrid(dayKey: string): string[][] {
  const noon = vnNoonUtcForCalendarYmd(dayKey);
  const monthStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISTING_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
  }).format(noon);
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const firstDow = new Date(y!, m! - 1, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const cells: string[] = [];
  for (let i = 0; i < startOffset; i++) cells.push("");
  for (let d = 1; d <= lastDay; d++) {
    cells.push(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push("");
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function minutesFromDayStart(date: Date): number {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: LISTING_DISPLAY_TZ,
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
  const m = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: LISTING_DISPLAY_TZ,
      minute: "2-digit",
    }).format(date),
  );
  return h * 60 + m - DAY_START_HOUR * 60;
}

export function snapMinutes(min: number) {
  return Math.round(min / 15) * 15;
}

export function minToHHMM(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function buildBlockTimes(startMin: number) {
  const snapped = snapMinutes(
    Math.max(0, Math.min(startMin, (DAY_END_HOUR - DAY_START_HOUR) * 60)),
  );
  const endMin = Math.min(
    snapped + 60,
    (DAY_END_HOUR - DAY_START_HOUR + 1) * 60,
  );
  return {
    startHHMM: minToHHMM(DAY_START_HOUR * 60 + snapped),
    endHHMM: minToHHMM(DAY_START_HOUR * 60 + endMin),
  };
}
