import { BOOKING_START_TOLERANCE_MS } from '../../../common/availability/listing-slot-policy';

/**
 * Наступило ли **время начала слота** `startsAt` (с тем же допуском, что при создании брони).
 * Нужно для: старт приёма `in_progress`, no-show из `confirmed`, и т.п.
 */
export function isBookingSlotStartTimeReached(
  startsAt: Date,
  now: Date,
): boolean {
  return now.getTime() >= startsAt.getTime() - BOOKING_START_TOLERANCE_MS;
}

/**
 * @alias {@link isBookingSlotStartTimeReached}
 */
export function isBookingStartTimeReachedForInProgress(
  startsAt: Date,
  now: Date,
): boolean {
  return isBookingSlotStartTimeReached(startsAt, now);
}
