import type { AppLocale } from "@/app/i18n/routing";
import type { AvailabilitySlotGroup } from "@/shared/ui";
import { formatListingSlotStripDayLabel } from "@/shared/lib/datetime/listing-slot-day-label";
import type { DirectorySlotGroupSeed } from "@/shared/lib/directory-slot-group-seed";

/**
 * Карточки в поиске / главной: подпись дня по календарной дате витрины.
 * `maxGroups` ограничивает полосу на карточке (полный список дней — на профиле).
 */
export function slotGroupsFromSeed(
  groups: DirectorySlotGroupSeed[] | undefined | null,
  tSlots: (key: string) => string,
  opts: { locale: AppLocale; maxGroups?: number; now?: Date },
): AvailabilitySlotGroup[] {
  const raw = groups ?? [];
  const capped =
    opts.maxGroups != null && opts.maxGroups >= 0
      ? raw.slice(0, opts.maxGroups)
      : raw;

  return capped.map((g) => ({
    calendarDate: g.calendarDate,
    dayLabel: formatListingSlotStripDayLabel(g.calendarDate, {
      locale: opts.locale,
      tSlots,
      now: opts.now,
    }),
    times: g.times ?? [],
  }));
}
