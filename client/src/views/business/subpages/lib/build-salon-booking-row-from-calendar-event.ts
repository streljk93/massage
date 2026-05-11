import type { CalendarEvent } from "@/widgets/calendar";
import {
  isBookingStatus,
  type BookingStatus,
  type SalonBookingRow,
} from "@/entities/booking";

function resolveBookingStatusFromCalendarEvent(event: CalendarEvent): BookingStatus {
  if (event.type !== "booking" || event.booking == null) {
    return "pending";
  }
  if (isBookingStatus(event.booking.status)) {
    return event.booking.status;
  }
  return "pending";
}

/**
 * Минимальная строка «как у салонного списка», если полный ответ `/salon-bookings` ещё не в кэше.
 */
export function buildSalonBookingRowFromCalendarEvent(
  event: CalendarEvent,
  getStatusLabel: (status: BookingStatus) => string,
): SalonBookingRow | null {
  if (event.type !== "booking" || event.booking == null) {
    return null;
  }
  const b = event.booking;
  const status = resolveBookingStatusFromCalendarEvent(event);
  const specialistResource = event.resources.find((r) => r.specialistId != null);
  const specialistId = specialistResource?.specialistId ?? "";

  return {
    id: b.id,
    status,
    statusLabel: getStatusLabel(status),
    specialistId,
    specialistName: b.specialistName ?? "",
    specialistImageUrl: null,
    organizationId: event.organizationId,
    organizationName: null,
    clientDisplayName: b.clientDisplayName,
    categoryShortName: b.categoryShortName,
    amount: b.amount,
    currency: b.currency,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    pendingExpiresAt: null,
    cancelReason: null,
    cancellationComment: null,
    visitReviewComplete: false,
    visitReviewOrganizationRating: null,
    visitReviewSpecialistRating: null,
    visitReviewDisplayRating: null,
    visitReviewOrganizationExcerpt: null,
    visitReviewSpecialistExcerpt: null,
    visitReviewExcerpt: null,
  };
}
