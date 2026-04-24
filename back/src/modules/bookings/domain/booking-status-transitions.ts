import type { BookingStatus } from '@prisma/client';

/**
 * Разрешённые целевые статусы по текущему статусу (продуктовая матрица).
 * Переходы из `confirmed` в `in_progress`, `no_show_by_client`, `no_show_by_master`
 * дополнительно требуют наступившего времени начала слота `startsAt`
 * (см. {@link isBookingSlotStartTimeReached}).
 * @see `.cursor/rules/business-logic.mdc` — раздел «Допустимые переходы статусов».
 *
 * Исключения, не сводящиеся к одной строке таблицы:
 * - `in_progress` → `canceled_by_master` — только системная массовая отмена при смене активной
 *   организации у специалиста ({@link BookingsRepository.cancelActiveBookingsAtOrganization}).
 * - `in_progress` → `done` — также по cron, когда `endsAt` ≤ текущее время
 *   ({@link BookingsRepository.completeInProgressPastEndsAt}).
 */
export const BOOKING_STATUS_TRANSITION_MAP: Record<
  BookingStatus,
  readonly BookingStatus[]
> = {
  pending: ['expired', 'reject_by_master', 'reject_by_client', 'confirmed'],
  confirmed: [
    'in_progress',
    'no_show_by_client',
    'no_show_by_master',
    'canceled_by_master',
    'canceled_by_client',
  ],
  in_progress: ['done'],
  expired: [],
  reject_by_master: [],
  reject_by_client: [],
  canceled_by_master: [],
  canceled_by_client: [],
  no_show_by_client: [],
  no_show_by_master: [],
  done: [],
};

/**
 * Разрешён ли переход `from` → `to` (включая задокументированные системные исключения).
 */
export function isBookingStatusTransitionAllowed(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  if (from === to) {
    return true;
  }
  const targets = BOOKING_STATUS_TRANSITION_MAP[from];
  if (targets.includes(to)) {
    return true;
  }
  if (from === 'in_progress' && to === 'canceled_by_master') {
    return true;
  }
  return false;
}

export function assertBookingStatusTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!isBookingStatusTransitionAllowed(from, to)) {
    throw new Error(`Invalid booking status transition: ${from} -> ${to}`);
  }
}
