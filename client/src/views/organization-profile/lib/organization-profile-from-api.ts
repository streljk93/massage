import type { SalonSpecialistPick } from "@/entities/specialists";
import type { OrganizationsGetByIdResponse } from "@/shared/api";
import { availabilityFromDirectorySlotGroups } from "@/shared/lib/directory-slot-calendar";
import { resolveDirectoryImageSrc } from "@/widgets/home/lib/directory-cards-from-api";
import type { OrganizationProfileData } from "../model/organization-profile-data";

export function organizationProfileFromApiDetail(
  detail: OrganizationsGetByIdResponse,
): OrganizationProfileData {
  const imageSrc = resolveDirectoryImageSrc(detail.imageUrl);
  const lat = detail.latitude ?? 0;
  const lng = detail.longitude ?? 0;
  const addressLine =
    [detail.addressLine, detail.city].filter(Boolean).join(", ") ||
    detail.metaLine;

  const specialists: SalonSpecialistPick[] = detail.staff.map((s) => ({
    specialistId: s.id,
    name: s.name,
    imageSrc: resolveDirectoryImageSrc(s.imageUrl),
    imageAlt: s.name,
    rating: s.rating,
    metaLine: s.metaLine,
    bookableServices: (s.bookableServices ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      durationMinutes: b.durationMinutes as readonly number[],
      priceVndByDuration: b.priceVndByDuration as readonly number[],
    })),
  }));

  const { calendarDays, timeSlotsByDay, slotCalendarDates } =
    availabilityFromDirectorySlotGroups(detail.slotGroups);

  return {
    id: detail.id,
    name: detail.name,
    imageSrc,
    imageAlt: detail.name,
    rating: detail.rating,
    lat,
    lng,
    reviewsCount: detail.reviewsCount,
    addressLine,
    yearsInBusiness: detail.yearsInBusiness ?? 0,
    specialistsCount: specialists.length,
    calendarDays,
    timeSlotsByDay,
    slotCalendarDates,
    specialists,
  };
}
