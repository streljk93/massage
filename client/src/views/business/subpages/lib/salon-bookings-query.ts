export const SALON_BOOKINGS_QUERY_KEY_PREFIX = ["specialistSalonBookings"] as const;

export const SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE = "active_workplace" as const;

export function salonBookingsActiveWorkplaceQueryKey(
  accessToken: string,
  locale: string,
) {
  return [
    ...SALON_BOOKINGS_QUERY_KEY_PREFIX,
    SALON_BOOKINGS_SCOPE_ACTIVE_WORKPLACE,
    accessToken,
    locale,
  ] as const;
}
