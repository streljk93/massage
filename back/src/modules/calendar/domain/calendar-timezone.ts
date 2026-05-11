import { toZonedTime } from 'date-fns-tz';

export const DEFAULT_ORGANIZATION_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function normalizeOrganizationTimeZone(raw: string | null | undefined) {
  const tz = raw?.trim() || DEFAULT_ORGANIZATION_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_ORGANIZATION_TIME_ZONE;
  }
}

export function localWeekdayInTimeZone(instant: Date, timeZone: string): number {
  return toZonedTime(instant, normalizeOrganizationTimeZone(timeZone)).getDay();
}

export function localMinuteOfDayInTimeZone(
  instant: Date,
  timeZone: string,
): number {
  const z = toZonedTime(instant, normalizeOrganizationTimeZone(timeZone));
  return z.getHours() * 60 + z.getMinutes();
}

function localDayOrdinal(zoned: Date): number {
  return Math.floor(
    Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate()) /
      86_400_000,
  );
}

function isLocalMidnight(zoned: Date): boolean {
  return (
    zoned.getHours() === 0 &&
    zoned.getMinutes() === 0 &&
    zoned.getSeconds() === 0 &&
    zoned.getMilliseconds() === 0
  );
}

export type LocalIntervalBounds = {
  date: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

/**
 * Возвращает wall-clock границы интервала в timezone организации.
 * Конец ровно в 00:00 следующего локального дня трактуется как 24:00 текущего дня.
 */
export function localIntervalBoundsInTimeZone(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): LocalIntervalBounds | null {
  const tz = normalizeOrganizationTimeZone(timeZone);
  const start = toZonedTime(startsAt, tz);
  const end = toZonedTime(endsAt, tz);
  const startDay = localDayOrdinal(start);
  const endDay = localDayOrdinal(end);
  const endsAtNextLocalMidnight = endDay === startDay + 1 && isLocalMidnight(end);
  if (endDay !== startDay && !endsAtNextLocalMidnight) {
    return null;
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`,
    weekday: start.getDay(),
    startMinute: start.getHours() * 60 + start.getMinutes(),
    endMinute:
      endsAtNextLocalMidnight ? 24 * 60 : end.getHours() * 60 + end.getMinutes(),
  };
}

export function sameLocalDateInTimeZone(
  a: Date,
  b: Date,
  timeZone: string,
): boolean {
  const tz = normalizeOrganizationTimeZone(timeZone);
  const za = toZonedTime(a, tz);
  const zb = toZonedTime(b, tz);
  return (
    za.getFullYear() === zb.getFullYear() &&
    za.getMonth() === zb.getMonth() &&
    za.getDate() === zb.getDate()
  );
}

export function localYmdInTimeZone(instant: Date, timeZone: string): string {
  const z = toZonedTime(instant, normalizeOrganizationTimeZone(timeZone));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${z.getFullYear()}-${p(z.getMonth() + 1)}-${p(z.getDate())}`;
}
