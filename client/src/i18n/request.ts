import { getRequestConfig } from "next-intl/server";
import { loadMessagesForLocale } from "./load-messages";
import { routing } from "./routing";

const supportedLocales = routing.locales as readonly string[];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !supportedLocales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: loadMessagesForLocale(locale),
  };
});
