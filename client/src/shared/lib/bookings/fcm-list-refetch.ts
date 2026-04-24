/**
 * FCM / SW → список «Мои записи»: единый CustomEvent, чтобы `BookingsPage` подтянул данные с API.
 * Источник `type` в `data` — `push-notifications.service` (backend).
 */
export const FCM_CLIENT_BOOKINGS_LIST_REFETCH = "fcm:client-bookings-list-refetch";

const FCM_LIST_REFETCH_TYPES = new Set([
  "booking_status",
  "booking_client_reminder",
]);

export function fcmDataShouldRefetchClientBookingsList(
  data: Record<string, string> | undefined,
): boolean {
  if (data == null) {
    return false;
  }
  const type = data.type;
  return type != null && FCM_LIST_REFETCH_TYPES.has(type);
}

export function requestClientBookingsListRefetch(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(FCM_CLIENT_BOOKINGS_LIST_REFETCH));
}
