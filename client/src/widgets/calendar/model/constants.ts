import type { ViewMode } from "./types";

export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 23;
export const HOUR_HEIGHT_PX = 64;
export const TIME_COL_W = 56;
export const COL_MIN_W_DAY = 180;
export const COL_MIN_W_WEEK = 100;

export const VIEW_MODES: ViewMode[] = ["day", "week", "month", "list"];

export const DOT_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
] as const;

export const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i,
);

export const TOTAL_GRID_H = HOURS.length * HOUR_HEIGHT_PX;

/**
 * Вертикальный отступ для sticky-шапки сетки/месяца под `CalendarToolbar`.
 * Должно совпадать с фактической высотой тулбара (2 ряда на `< lg`, один ряд + `lg:py-2`).
 */
export const CALENDAR_GRID_STICKY_TOP_CLASS = "top-[6.5rem] lg:top-[3.5rem]";
