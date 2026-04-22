/**
 * Статусы бронирования — синхронно с `BookingStatus` в Prisma и бизнес-правилами.
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

export function bookingHistoryDateTagsMuted(status: string): boolean {
  return isBookingStatus(status)
    ? BOOKING_HISTORY_MUTED_DATE_TAGS_STATUSES.has(status)
    : true;
}
