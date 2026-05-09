import type { BookingEventType } from '@prisma/client';
import type { BookingCoarseState } from './booking-state.types';

/**
 * Переходы «крупное состояние → допустимый следующий тип события» перед append.
 * Отмена во время приёма (`active` + `canceled`) допускается только с флагом массовой отмены организации.
 */
export const BOOKING_COARSE_ALLOWED_EVENT_TYPES: Record<
  Exclude<BookingCoarseState, null>,
  BookingEventType[]
> = {
  pending: ['confirmed', 'rejected', 'canceled', 'expired'],
  confirmed: ['started', 'canceled', 'no_show', 'rescheduled'],
  /** `canceled` в ходе приёма — только массовые сценарии (`allowMassOrgSpecialistCancel`), см. `BookingAppendService`. */
  active: ['completed', 'no_show'],
  rejected: [],
  canceled: [],
  expired: [],
  completed: [],
  no_show: [],
};

export function isBookingEventTypeAllowedFromCoarse(
  coarseBefore: BookingCoarseState | null,
  nextType: BookingEventType,
  opts?: { bootstrapCreated?: boolean },
): boolean {
  if (opts?.bootstrapCreated && nextType === 'created') {
    return coarseBefore === null;
  }
  if (nextType === 'created') {
    return coarseBefore === null;
  }
  if (!coarseBefore) {
    return false;
  }
  const targets = BOOKING_COARSE_ALLOWED_EVENT_TYPES[coarseBefore];
  return targets.includes(nextType);
}
