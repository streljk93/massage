/**
 * Статусы бронирования — синхронно с `BookingStatus` в Prisma и бизнес-правилами.
 * Канонический порядок и полнота: `back/src/modules/bookings/domain/booking-status-all-ordered.ts`.
 * @see back/prisma/schema.prisma
 * @see .cursor/rules/business-logic.mdc
 */
export const BOOKING_STATUSES = [
  "pending",
  "expired",
  "reject_by_master",
  "reject_by_client",
  "confirmed",
  "canceled_by_master",
  "canceled_by_client",
  "no_show_by_client",
  "no_show_by_master",
  "in_progress",
  "done",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const BOOKING_STATUS_SET = new Set<string>(BOOKING_STATUSES);

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUS_SET.has(value);
}

/** История: приглушить дату/время для «негативных» итоговых статусов. */
export const BOOKING_HISTORY_MUTED_DATE_TAGS_STATUSES = new Set<BookingStatus>([
  "expired",
  "reject_by_master",
  "reject_by_client",
  "canceled_by_master",
  "canceled_by_client",
  "no_show_by_client",
  "no_show_by_master",
]);

/**
 * Календарь кабинета: не рисовать события-записи с этими доменными статусами (шум в слоте).
 * `CalendarEvent.status === "cancelled"` на бэке также ставится для `done` и no-show — фильтр только по `booking.status`.
 */
export const BOOKING_CALENDAR_HIDDEN_STATUSES = new Set<BookingStatus>([
  "expired",
  "reject_by_master",
  "reject_by_client",
  "canceled_by_master",
  "canceled_by_client",
]);

export function bookingHistoryDateTagsMuted(status: string): boolean {
  return isBookingStatus(status)
    ? BOOKING_HISTORY_MUTED_DATE_TAGS_STATUSES.has(status)
    : true;
}
