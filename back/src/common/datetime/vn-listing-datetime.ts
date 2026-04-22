import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/** Таймзона витрины (слоты и брони в каталоге). */
export const LISTING_DISPLAY_TZ = 'Asia/Ho_Chi_Minh';

const FMT_YMD = 'yyyy-MM-dd';
const FMT_HM = 'HH:mm';

/**
 * Календарное «стенное» время витрины (Asia/Ho_Chi_Minh, без DST) → UTC `Date`.
 * Не использовать `new Date(y, m, d, h, min)` — оно привязано к TZ процесса Node.
 */
export function vnWallClockToUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const p = (n: number) => String(n).padStart(2, '0');
  return parseISO(
    `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:00+07:00`,
  );
}

export function formatListingCalendarYmd(date: Date): string {
  return formatInTimeZone(date, LISTING_DISPLAY_TZ, FMT_YMD);
}

export function formatListingClockHm(date: Date): string {
  return formatInTimeZone(date, LISTING_DISPLAY_TZ, FMT_HM);
}

/** Ключ `yyyy-MM-dd|HH:mm` для сопоставления слота витрины с интервалом брони. */
export function formatListingOccupiedSlotKey(startsAt: Date): string {
  return `${formatListingCalendarYmd(startsAt)}|${formatListingClockHm(startsAt)}`;
}
