import { BookingStatus, CalendarEventStatus } from '@prisma/client';
import {
  CALENDAR_BLOCKING_EVENT_STATUSES,
  calendarStatusFromBookingStatus,
} from './calendar-event-status';

describe('calendar event status invariants', () => {
  it('keeps the blocking set explicit and minimal', () => {
    expect(CALENDAR_BLOCKING_EVENT_STATUSES).toEqual([
      CalendarEventStatus.pending,
      CalendarEventStatus.confirmed,
      CalendarEventStatus.in_progress,
    ]);
  });

  it('maps only active booking lifecycle states to blocking calendar states', () => {
    expect(calendarStatusFromBookingStatus(BookingStatus.pending)).toBe(
      CalendarEventStatus.pending,
    );
    expect(calendarStatusFromBookingStatus(BookingStatus.confirmed)).toBe(
      CalendarEventStatus.confirmed,
    );
    expect(calendarStatusFromBookingStatus(BookingStatus.in_progress)).toBe(
      CalendarEventStatus.in_progress,
    );
    expect(calendarStatusFromBookingStatus(BookingStatus.done)).toBe(
      CalendarEventStatus.cancelled,
    );
    expect(
      calendarStatusFromBookingStatus(BookingStatus.canceled_by_client),
    ).toBe(CalendarEventStatus.cancelled);
  });
});
