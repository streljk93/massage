import type { BookingListStatus } from "@/entities/booking";

const NEW_TAB_STATUSES = new Set([
  "pending",
  "confirmed",
  "in_progress",
]);

export function bookingIsNewTab(status: string): boolean {
  return NEW_TAB_STATUSES.has(status);
}

/** Вкладка «Новые»: сначала текущий приём, остальные — по времени начала. */
export function compareBookingsNewTabPriority(
  a: { status: string; startsAt: string },
  b: { status: string; startsAt: string },
): number {
  const rank = (s: string) => (s === "in_progress" ? 0 : 1);
  const byRank = rank(a.status) - rank(b.status);
  if (byRank !== 0) {
    return byRank;
  }
  return a.startsAt.localeCompare(b.startsAt);
}

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
