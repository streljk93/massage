import type { BookingListStatus } from "@/entities/booking";

export { bookingIsNewTab, compareBookingsNewTabPriority } from "@/entities/booking";

export function mapApiStatusToListCard(status: string): BookingListStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "confirmed":
      return "confirmed";
    case "in_progress":
      return "in_progress";
    case "expired":
      return "expired";
    case "reject_by_master":
    case "reject_by_client":
      return "rejected";
    default:
      return "expired";
  }
}
