/**
 * Политика v14: первая транзакция + до `BOOKING_EXCLUDE_MAX_RETRIES` повторов при 23P01
 * с jitter 5–30 ms; затем финальный overlap вне транзакции и ещё одна попытка INSERT.
 */
export const BOOKING_EXCLUDE_MAX_RETRIES = 2;

/** Всего до 1 + BOOKING_EXCLUDE_MAX_RETRIES попыток транзакции создания/переноса слота. */
export const BOOKING_SLOT_TX_ATTEMPT_CAP = 1 + BOOKING_EXCLUDE_MAX_RETRIES;

export const BOOKING_EXCLUDE_RETRY_JITTER_MS_MIN = 5;
export const BOOKING_EXCLUDE_RETRY_JITTER_MS_SPAN = 26;

export function bookingExcludeRetryJitterMs(): number {
  return (
    BOOKING_EXCLUDE_RETRY_JITTER_MS_MIN +
    Math.floor(Math.random() * BOOKING_EXCLUDE_RETRY_JITTER_MS_SPAN)
  );
}
