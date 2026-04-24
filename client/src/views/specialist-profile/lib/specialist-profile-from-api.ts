import type { BookableServiceOption } from "@/entities/services";
import type { SpecialistsGetByIdResponse } from "@/shared/api";
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
  const card = specialistCardSeedFromApi(
    detail as Parameters<typeof specialistCardSeedFromApi>[0],
  );
  const { calendarDays, timeSlotsByDay, slotCalendarDates } =
    availabilityFromDirectorySlotGroups(detail.slotGroups);

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
    clientsLabel: "—",
    reviewsCount: detail.reviewsCount,
    calendarDays: calendarDays as SpecialistCalendarDay[],
    timeSlotsByDay,
    slotCalendarDates,
    services: bookableServicesFromApi(detail),
  };
}
