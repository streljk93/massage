"use client";

import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { formatListingSlotStripDayLabel } from "@/shared/lib/datetime/listing-slot-day-label";
import { dateFnsLocaleForAppLocale } from "@/shared/lib/datetime/date-fns-app-locale";
import {
  formatListingCalendarYmd,
  LISTING_DISPLAY_TZ,
  vnNoonUtcForCalendarYmd,
} from "@/shared/lib/datetime/vn-listing-datetime";
import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import type { CatalogSlotTimeFilterValue } from "./catalog-filters";

/** Как у `SelectTrigger size="sm"`: там `rounded-lg`, не переопределять `rounded-xl` — общий контур для пары «день | время». */
const CATALOG_SLOT_TIME_TRIGGER_SHELL =
  "h-10 w-full min-w-0 rounded-lg border-border/45 bg-card py-2 text-sm text-foreground";

/** Radix Select не принимает `value=""` у пункта — в сторе фильтра остаётся `""`. */
const CATALOG_FILTERS_SLOT_ANY = "__cf_slotAny__";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isListingDayBeforeToday(date: Date, now: Date): boolean {
  return formatListingCalendarYmd(date) < formatListingCalendarYmd(now);
}

type CatalogSlotTimeFilterProps = {
  value: CatalogSlotTimeFilterValue;
  onChange: (next: CatalogSlotTimeFilterValue) => void;
  timeOptions: { value: string; label: string }[];
};

export function CatalogSlotTimeFilter({
  value,
  onChange,
  timeOptions,
}: CatalogSlotTimeFilterProps) {
  const t = useTranslations("catalogFilters");
  const tSlots = useTranslations("slots");
  const locale = useLocale() as AppLocale;
  const slotDayInputId = useId();
  const slotTimeSelectId = useId();
  const listingNow = useMemo(() => new Date(), []);

  const selectedDate = useMemo(
    () =>
      value.day && ISO_DATE.test(value.day)
        ? vnNoonUtcForCalendarYmd(value.day)
        : undefined,
    [value.day],
  );

  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label
          className="text-xs font-medium text-foreground/90"
          htmlFor={slotDayInputId}
        >
          {t("slotDay")}
        </label>
        <DatePicker
          id={slotDayInputId}
          value={selectedDate}
          placeholder={t("slotAny")}
          defaultMonth={selectedDate ?? listingNow}
          timeZone={LISTING_DISPLAY_TZ}
          locale={dateFnsLocaleForAppLocale(locale)}
          weekStartsOn={1}
          formatValue={(date) =>
            formatListingSlotStripDayLabel(formatListingCalendarYmd(date), {
              locale,
              tSlots,
              now: listingNow,
            })
          }
          disabled={(date) => isListingDayBeforeToday(date, listingNow)}
          className={CATALOG_SLOT_TIME_TRIGGER_SHELL}
          onChange={(date) => {
            const day = date ? formatListingCalendarYmd(date) : "";
            onChange({
              day,
              time: day ? value.time : "",
            });
          }}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label
          className="text-xs font-medium text-foreground/90"
          htmlFor={slotTimeSelectId}
        >
          {t("slotTime")}
        </label>
        <Select
          value={value.time === "" ? CATALOG_FILTERS_SLOT_ANY : value.time}
          onValueChange={(nextValue) => {
            const time = nextValue === CATALOG_FILTERS_SLOT_ANY ? "" : nextValue;
            onChange({
              day: time ? value.day : "",
              time,
            });
          }}
        >
          <SelectTrigger
            id={slotTimeSelectId}
            className={CATALOG_SLOT_TIME_TRIGGER_SHELL}
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value={CATALOG_FILTERS_SLOT_ANY}>
              {t("slotAny")}
            </SelectItem>
            {timeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
