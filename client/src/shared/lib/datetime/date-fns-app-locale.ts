import type { Locale } from "date-fns";
import { enUS, ru, vi } from "date-fns/locale";
import type { AppLocale } from "@/app/i18n/routing";

const MAP: Record<AppLocale, Locale> = {
  en: enUS,
  vi,
  ru,
};

/** Локаль `date-fns` для коротких дат витрины (карточки каталога и т.п.). */
export function dateFnsLocaleForAppLocale(locale: AppLocale): Locale {
  return MAP[locale];
}
