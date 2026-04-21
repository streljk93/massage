import type { BookingListStatus } from "@/entities/booking";

const NEW_TAB_STATUSES = new Set([
  "pending",
  "confirmed",
  "in_progress",
]);

export function bookingIsNewTab(status: string): boolean {
  return NEW_TAB_STATUSES.has(status);
}

export function mapApiStatusToListCard(status: string): BookingListStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "confirmed":
    case "in_progress":
      return "confirmed";
    case "expired":
      return "expired";
    case "reject_by_master":
    case "reject_by_client":
      return "rejected";
    default:
      return "expired";
  }
}
