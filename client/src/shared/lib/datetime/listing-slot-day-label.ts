import type { AppLocale } from "@/app/i18n/routing";
import { dateFnsLocaleForAppLocale } from "@/shared/lib/datetime/date-fns-app-locale";
import {
  formatListingCalendarYmd,
  formatListingDayStripLabel,
  vnCalendarYmdString,
  vnTomorrowFromNow,
} from "@/shared/lib/datetime/vn-listing-datetime";

/**
 * Подпись дня на полосе слотов: «сегодня» / «завтра» (i18n `slots`) для дат витрины,
 * иначе короткая дата в локали `date-fns`.
 */
export function formatListingSlotStripDayLabel(
  calendarDate: string,
  args: {
    locale: AppLocale;
    tSlots: (key: string) => string;
    now?: Date;
  },
): string {
  const now = args.now ?? new Date();
  const todayYmd = formatListingCalendarYmd(now);
  const tomorrowYmd = vnCalendarYmdString(vnTomorrowFromNow(now));
  if (calendarDate === todayYmd) {
    return args.tSlots("today");
  }
  if (calendarDate === tomorrowYmd) {
    return args.tSlots("tomorrow");
  }
  return formatListingDayStripLabel(
    calendarDate,
    dateFnsLocaleForAppLocale(args.locale),
  );
}
