import {
  CalendarEventStatus,
  type BookingStatus,
} from '@prisma/client';

export const CALENDAR_BLOCKING_EVENT_STATUSES = [
  CalendarEventStatus.pending,
  CalendarEventStatus.confirmed,
  CalendarEventStatus.in_progress,
] as const satisfies readonly CalendarEventStatus[];

export const CALENDAR_VISIBLE_EVENT_STATUSES = [
  CalendarEventStatus.pending,
  CalendarEventStatus.confirmed,
  CalendarEventStatus.in_progress,
  CalendarEventStatus.cancelled,
] as const satisfies readonly CalendarEventStatus[];

export function calendarStatusFromBookingStatus(
  status: BookingStatus,
): CalendarEventStatus {
  switch (status) {
    case 'pending':
      return CalendarEventStatus.pending;
    case 'confirmed':
      return CalendarEventStatus.confirmed;
    case 'in_progress':
      return CalendarEventStatus.in_progress;
    case 'expired':
    case 'reject_by_master':
    case 'reject_by_client':
    case 'canceled_by_master':
    case 'canceled_by_client':
    case 'no_show_by_client':
    case 'no_show_by_master':
    case 'done':
      return CalendarEventStatus.cancelled;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}
