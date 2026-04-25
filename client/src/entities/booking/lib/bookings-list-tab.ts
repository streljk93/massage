/**
 * Вкладки списка на `/bookings` и возврат с `/bookings/[id]/rate`.
 * Список: `?tab=history` — история; иначе — новые.
 * Оценка визита: `?bookingsTab=history` — вернуться в историю (по умолчанию — в «Новые»).
 */
export type BookingsListTab = "new" | "history";

export function parseBookingsListTab(raw: string | null): BookingsListTab {
  if (raw === "history") {
    return "history";
  }
  return "new";
}

/** URL списка записей с сохранённой вкладкой. */
export function buildBookingsListPath(tab: BookingsListTab): string {
  if (tab === "history") {
    return "/bookings?tab=history";
  }
  return "/bookings";
}

/**
 * Ссылка на оценку визита; при открытии с «История» передаётся `bookingsTab=history`.
 */
export function buildVisitRatePath(
  bookingId: string,
  listTab: BookingsListTab,
): string {
  if (listTab === "history") {
    return `/bookings/${bookingId}/rate?bookingsTab=history`;
  }
  return `/bookings/${bookingId}/rate`;
}
