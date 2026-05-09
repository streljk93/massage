import { BadRequestException } from '@nestjs/common';
import { BookingEventType } from '@prisma/client';

import { BOOKING_EVENT_TRANSITION_DEV } from './booking-event-transition-kind';
import type { BookingTimelineEvent } from './booking-projection';
import {
  projectBookingRowFromTimeline,
} from './booking-projection';
import { isBookingStatusTransitionAllowed } from './booking-status-transitions';

function isDevTransitionPayload(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object') {
    return false;
  }
  return (
    (payload as { transitionKindDev?: string }).transitionKindDev ===
    BOOKING_EVENT_TRANSITION_DEV
  );
}

/**
 * Strict-проверка перед INSERT события: финальный статус после добавления шага
 * должен быть достижим по продуктовой матрице (кроме dev/reschedule-случаев).
 */
export function assertStrictGranularTransitionForAppend(args: {
  prevTimeline: BookingTimelineEvent[];
  tentativeNewEvent: BookingTimelineEvent;
}): void {
  const { prevTimeline, tentativeNewEvent } = args;
  if (tentativeNewEvent.type === BookingEventType.created) {
    return;
  }
  if (isDevTransitionPayload(tentativeNewEvent.payload)) {
    return;
  }

  const before = projectBookingRowFromTimeline(prevTimeline);
  const after = projectBookingRowFromTimeline([
    ...prevTimeline,
    tentativeNewEvent,
  ]);

  if (tentativeNewEvent.type === BookingEventType.rescheduled) {
    if (before.status !== 'confirmed' || after.status !== 'confirmed') {
      throw new BadRequestException({
        code: 'BOOKING_RESCHEDULE_INVALID_STATE',
        message: 'rescheduled event requires confirmed booking before and after',
      });
    }
    return;
  }

  if (
    before.status === after.status &&
    before.startsAt.getTime() === after.startsAt.getTime() &&
    before.endsAt.getTime() === after.endsAt.getTime()
  ) {
    return;
  }

  if (!isBookingStatusTransitionAllowed(before.status, after.status)) {
    throw new BadRequestException({
      code: 'BOOKING_STRICT_STATUS_TRANSITION',
      message: `Disallowed status change implied by event: ${before.status} -> ${after.status}`,
    });
  }
}
