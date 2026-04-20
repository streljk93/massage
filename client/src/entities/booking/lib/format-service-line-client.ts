import type { useFormatter, useTranslations } from "next-intl";

type ClientT = ReturnType<typeof useTranslations>;
type ClientFormat = ReturnType<typeof useFormatter>;

/**
 * Клиентский аналог {@link formatBookingServiceLine} для экранов с `useTranslations` / `useFormatter`.
 */
export function formatBookingServiceLineClient(
  t: ClientT,
  format: ClientFormat,
  parts: {
    serviceLabel: string;
    amount: number;
    currency: string;
  },
): string {
  return t("booking.serviceLine", {
    service: parts.serviceLabel,
    price: format.number(parts.amount, {
      style: "currency",
      currency: parts.currency,
    }),
  });
}
