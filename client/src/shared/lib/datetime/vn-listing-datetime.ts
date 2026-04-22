import { addDays, parseISO, type Locale } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

/** Как на бэкенде: витрина в Asia/Ho_Chi_Minh. */
export const LISTING_DISPLAY_TZ = "Asia/Ho_Chi_Minh";

const FMT_YMD = "yyyy-MM-dd";
const FMT_HM = "HH:mm";

export function vnWallClockToUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const p = (n: number) => String(n).padStart(2, "0");
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

/** Полдень по стенным часам витрины для `calendarDate` (yyyy-MM-dd) — якорь для подписей. */
export function vnNoonUtcForCalendarYmd(calendarDate: string): Date {
  const [y, mo, d] = calendarDate.split("-").map(Number);
  return vnWallClockToUtcDate(y, mo, d, 12, 0);
}

/**
 * Короткая подпись дня для полосы слотов на карточке (`EEE, d MMM` в таймзоне витрины).
 * `locale` — локаль `date-fns` (см. {@link dateFnsLocaleForAppLocale}).
 */
export function formatListingDayStripLabel(
  calendarDate: string,
  locale: Locale = enUS,
): string {
  return formatInTimeZone(
    vnNoonUtcForCalendarYmd(calendarDate),
    LISTING_DISPLAY_TZ,
    "EEE, d MMM",
    { locale },
  );
}

/** Следующий календарный день витрины относительно `now`. */
export function vnTomorrowFromNow(now: Date): Date {
  const todayKey = formatListingCalendarYmd(now);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  return addDays(vnWallClockToUtcDate(ty, tm, td, 12, 0), 1);
}

/** `yyyy-MM-dd` в календаре витрины для момента времени. */
export function vnCalendarYmdString(d: Date): string {
  return formatListingCalendarYmd(d);
}
