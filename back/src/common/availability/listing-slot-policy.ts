import { toZonedTime } from 'date-fns-tz';
import { LISTING_DISPLAY_TZ } from '../datetime/vn-listing-datetime';

export {
  LISTING_DISPLAY_TZ,
  vnWallClockToUtcDate,
} from '../datetime/vn-listing-datetime';

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

const LISTING_CARD_PREVIEW_TAIL_MS = 26 * 60 * 60 * 1000;

/**
 * Окно превью для занятости и свободных слотов на карточках (горизонт + запас на последний слот дня).
 * Число дней задаётся в `src/config/configuration.ts` → `listingCardPreview.calendarDays`.
 */
export function listingCardPreviewWindowMs(calendarDays: number): number {
  const days = Math.max(1, Math.min(90, Math.floor(calendarDays)));
  return days * 24 * 60 * 60 * 1000 + LISTING_CARD_PREVIEW_TAIL_MS;
}

export function isStartAlignedToListingGrid(startsAt: Date): boolean {
  const z = toZonedTime(startsAt, LISTING_DISPLAY_TZ);
  return (
    z.getMilliseconds() === 0 &&
    z.getSeconds() === 0 &&
    z.getMinutes() % SLOT_GRID_MINUTES === 0
  );
}

/** Минуты с полуночи в `LISTING_DISPLAY_TZ` — как у витрины (`listingWorkday*` организации). */
export type ListingBookabilityWorkdayMinutes = {
  startMinute: number;
  endMinute: number;
};

export type ListingBookabilityCheck =
  | { ok: true }
  | { ok: false; code: 'NOT_GRID_ALIGNED' | 'OUTSIDE_WORKDAY' };

/**
 * Услуга должна укладываться в рабочий день одной календарной даты (витрина).
 * `workday` — границы из организации мастера; без него — {@link DEFAULT_WORKDAY}.
 */
export function checkListingBookability(
  startsAt: Date,
  endsAt: Date,
  workday?: ListingBookabilityWorkdayMinutes,
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
    workday?.startMinute ??
    DEFAULT_WORKDAY.startHour * 60 + DEFAULT_WORKDAY.startMinute;
  const maxEndMin = workday?.endMinute ?? DEFAULT_WORKDAY.endHour * 60;
  if (startMin < minAllowed || endMin > maxEndMin) {
    return { ok: false, code: 'OUTSIDE_WORKDAY' };
  }
  return { ok: true };
}
