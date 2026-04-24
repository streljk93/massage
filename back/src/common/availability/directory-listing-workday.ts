import { DEFAULT_WORKDAY, SLOT_GRID_MINUTES } from './listing-slot-policy';

/**
 * Минута начала приёма (включительно) и окончания (не включая последний 30-мин старт, т.е. end = 22:00 → последний старт 21:30).
 * Стенные часы витрины: Asia/Ho_Chi_Minh.
 */
export const DEFAULT_LISTING_WORKDAY_START_MINUTE =
  DEFAULT_WORKDAY.startHour * 60 + DEFAULT_WORKDAY.startMinute;

export const DEFAULT_LISTING_WORKDAY_END_MINUTE = DEFAULT_WORKDAY.endHour * 60;

/**
 * Сохранение валидного интервала; при сбойных данных — прежние дефолты витрины.
 * Границы приводим к сетке 30 мин.
 */
export function normalizeDirectoryListingWorkdayBounds(
  startMinute: number | null | undefined,
  endMinute: number | null | undefined,
): { startMinute: number; endMinute: number } {
  let a = startMinute ?? DEFAULT_LISTING_WORKDAY_START_MINUTE;
  let b = endMinute ?? DEFAULT_LISTING_WORKDAY_END_MINUTE;
  a = Math.floor(Math.max(0, a) / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
  b = Math.ceil(Math.max(0, b) / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
  b = Math.min(24 * 60, b);
  if (a >= b || b - a < SLOT_GRID_MINUTES) {
    return {
      startMinute: DEFAULT_LISTING_WORKDAY_START_MINUTE,
      endMinute: DEFAULT_LISTING_WORKDAY_END_MINUTE,
    };
  }
  return { startMinute: a, endMinute: b };
}
