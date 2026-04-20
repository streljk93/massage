import type { getFormatter, getTranslations } from "next-intl/server";

type MessagesFn = Awaited<ReturnType<typeof getTranslations>>;
type IntlFormatter = Awaited<ReturnType<typeof getFormatter>>;

/**
 * Собирает подпись услуги для карточки брони: локализованное имя + сумма в валюте.
 *
 * Откуда брать `serviceLabel` при данных с API:
 * - **Бэкенд уже отдал текст под локаль** (например по `Accept-Language`) — подставляй строку как есть.
 * - **Бэкенд отдал ключ** из ваших словарей — `serviceLabel: t(key)` (ключи лучше валидировать).
 * - **Справочник услуг с полями `title.en` / `title.vi` / `title.ru`** — выбери поле по текущей локали без `t()`.
 */
export function formatBookingServiceLine(
  t: MessagesFn,
  format: IntlFormatter,
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
