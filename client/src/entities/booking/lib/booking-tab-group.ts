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
