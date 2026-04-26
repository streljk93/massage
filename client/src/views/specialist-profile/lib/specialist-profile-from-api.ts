import type { BookableServiceOption } from "@/entities/services";
import type { SpecialistsGetByIdResponse } from "@/shared/api";
import {
  freeDirectorySlotGroupSeedsFromSpecialistOccupied,
  UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
} from "@/shared/lib/directory-free-slot-groups-from-occupied";
import { normalizeClientListingWorkday } from "@/shared/lib/directory-listing-workday";
import { availabilityFromDirectorySlotGroups } from "@/shared/lib/directory-slot-calendar";
import { specialistCardSeedFromApi } from "@/entities/specialists";
import type {
  SpecialistCalendarDay,
  SpecialistProfileData,
} from "../model/specialist-profile-data";

function bookableServicesFromApi(
  detail: SpecialistsGetByIdResponse,
): BookableServiceOption[] {
  const list = detail.bookableServices ?? [];
  return list.map((s) => ({
    id: s.id,
    title: s.name,
    categoryShortName: s.categoryShortName,
    durationMinutes: s.durationMinutes as readonly number[],
    priceVndByDuration: s.priceVndByDuration as readonly number[],
  }));
}

export function specialistProfileFromApiDetail(
  detail: SpecialistsGetByIdResponse,
): SpecialistProfileData {
  const now = new Date();
  const card = specialistCardSeedFromApi(
    detail as Parameters<typeof specialistCardSeedFromApi>[0],
    now,
  );
  const workday = normalizeClientListingWorkday(
    detail.listingWorkdayStartMinute,
    detail.listingWorkdayEndMinute,
  );
  const freeGroups = freeDirectorySlotGroupSeedsFromSpecialistOccupied(
    detail.slotGroups ?? [],
    now,
    UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
    workday,
  );
  const { calendarDays, timeSlotsByDay, slotCalendarDates } =
    availabilityFromDirectorySlotGroups(freeGroups);

  return {
    id: detail.id,
    name: detail.name,
    imageSrc: card.imageSrc,
    imageAlt: detail.name,
    rating: detail.rating,
    lat: card.lat,
    lng: card.lng,
    servicesLine: detail.servicesLine ?? "",
    experienceYears: detail.experienceYears ?? 0,
    doneClientsCount: detail.doneClientsCount,
    reviewsCount: detail.reviewsCount,
    calendarDays: calendarDays as SpecialistCalendarDay[],
    timeSlotsByDay,
    slotCalendarDates,
    services: bookableServicesFromApi(detail),
    phone: detail.phone ?? null,
    activeWorkplace: detail.activeWorkplace ?? null,
  };
}
