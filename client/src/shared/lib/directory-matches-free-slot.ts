import type { OrganizationsListResponse, SpecialistsListResponse } from "@/shared/api";
import {
  freeDirectorySlotGroupSeedsForOrganization,
  freeDirectorySlotGroupSeedsFromSpecialistOccupied,
  UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
} from "@/shared/lib/directory-free-slot-groups-from-occupied";
import {
  normalizeClientListingWorkday,
  normalizeDirectorySlotTimeHm,
} from "@/shared/lib/directory-listing-workday";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Org = OrganizationsListResponse["organizations"][number];
type Spec = SpecialistsListResponse["specialists"][number];

function freeGroupTimesForDay(
  groups: { calendarDate: string; times: string[] }[],
  day: string,
  timeNormalized: string,
): boolean {
  for (const g of groups) {
    if (g.calendarDate !== day) {
      continue;
    }
    for (const t of g.times ?? []) {
      if (normalizeDirectorySlotTimeHm(t) === timeNormalized) {
        return true;
      }
    }
  }
  return false;
}

/** Есть ли выбранный день+время в сетке свободных слотов (витрина, Asia/Ho_Chi_Minh). */
export function directorySpecialistHasFreeSlotAt(
  s: Spec,
  slotDay: string,
  slotTimeRaw: string,
  now: Date,
): boolean {
  if (!ISO.test(slotDay)) {
    return false;
  }
  const timeN = normalizeDirectorySlotTimeHm(slotTimeRaw);
  const wd = normalizeClientListingWorkday(
    s.listingWorkdayStartMinute,
    s.listingWorkdayEndMinute,
  );
  const free = freeDirectorySlotGroupSeedsFromSpecialistOccupied(
    s.slotGroups ?? [],
    now,
    UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
    wd,
  );
  return freeGroupTimesForDay(free, slotDay, timeN);
}

export function directoryOrganizationHasFreeSlotAt(
  o: Org,
  slotDay: string,
  slotTimeRaw: string,
  now: Date,
): boolean {
  if (!ISO.test(slotDay)) {
    return false;
  }
  const timeN = normalizeDirectorySlotTimeHm(slotTimeRaw);
  if ((o.slotGroups ?? []).length > 0) {
    return freeGroupTimesForDay(o.slotGroups ?? [], slotDay, timeN);
  }
  const per = (o.specialistOccupiedSlotKeys ?? []).map((e) => ({
    specialistId: e.specialistId,
    keys: e.keys ?? [],
  }));
  const wd = normalizeClientListingWorkday(
    o.listingWorkdayStartMinute,
    o.listingWorkdayEndMinute,
  );
  const free = freeDirectorySlotGroupSeedsForOrganization(
    per,
    now,
    UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
    wd,
  );
  return freeGroupTimesForDay(free, slotDay, timeN);
}
