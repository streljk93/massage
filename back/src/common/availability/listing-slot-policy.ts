import { toZonedTime } from 'date-fns-tz';

/** Таймзона витрины (слоты и брони в каталоге). */
export const LISTING_DISPLAY_TZ = 'Asia/Ho_Chi_Minh';

export const SLOT_GRID_MINUTES = 30;

/** Рабочий день по умолчанию: с 08:00 до 22:00 (окончание приёма — 22:00). */
export const DEFAULT_WORKDAY = {
  startHour: 8,
  startMinute: 0,
  endHour: 22,
} as const;

/**
 * Насколько старт слота может быть «в прошлом» относительно сервера и всё ещё считаться
 * допустимым (лаги сети, расхождение часов). Должен совпадать для витрины слотов и POST /bookings.
 */
export const BOOKING_START_TOLERANCE_MS = 120_000;

export function isStartAlignedToListingGrid(startsAt: Date): boolean {
  const z = toZonedTime(startsAt, LISTING_DISPLAY_TZ);
  return (
    z.getMilliseconds() === 0 &&
    z.getSeconds() === 0 &&
    z.getMinutes() % SLOT_GRID_MINUTES === 0
  );
}

export type ListingBookabilityCheck =
  | { ok: true }
  | { ok: false; code: 'NOT_GRID_ALIGNED' | 'OUTSIDE_WORKDAY' };

/** Услуга должна укладываться в дефолтный рабочий день одной календарной даты (витрина). */
export function checkListingBookability(
  startsAt: Date,
  endsAt: Date,
): ListingBookabilityCheck {
  if (!isStartAlignedToListingGrid(startsAt)) {
    return { ok: false, code: 'NOT_GRID_ALIGNED' };
  }
  const zS = toZonedTime(startsAt, LISTING_DISPLAY_TZ);
  const zE = toZonedTime(endsAt, LISTING_DISPLAY_TZ);
  if (
    zS.getFullYear() !== zE.getFullYear() ||
    zS.getMonth() !== zE.getMonth() ||
    zS.getDate() !== zE.getDate()
  ) {
    return { ok: false, code: 'OUTSIDE_WORKDAY' };
  }
  const startMin = zS.getHours() * 60 + zS.getMinutes();
  const endMin = zE.getHours() * 60 + zE.getMinutes();
  const minAllowed =
    DEFAULT_WORKDAY.startHour * 60 + DEFAULT_WORKDAY.startMinute;
  const maxEndMin = DEFAULT_WORKDAY.endHour * 60;
  if (startMin < minAllowed || endMin > maxEndMin) {
    return { ok: false, code: 'OUTSIDE_WORKDAY' };
  }
  return { ok: true };
}
