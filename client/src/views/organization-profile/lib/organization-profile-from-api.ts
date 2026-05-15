import type { SalonSpecialistPick } from "@/entities/specialists";
import type { OrganizationsGetByIdResponse } from "@/shared/api";
import { availabilityFromDirectorySlotGroups } from "@/shared/lib/directory-slot-calendar";
import { resolveDirectoryImageSrc } from "@/entities/organizations";
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
      categoryShortName: b.categoryShortName,
      majorSlug: b.majorSlug,
      majorName: b.majorName,
      majorSortOrder: b.majorSortOrder,
      durationMinutes: b.durationMinutes as readonly number[],
      priceVndByDuration: b.priceVndByDuration as readonly number[],
      organizationOfferingId: b.organizationOfferingId,
      marketplaceOfferingPriceOptionIds:
        b.marketplaceOfferingPriceOptionIds as readonly string[],
    })),
    occupiedListingSlotKeys: s.occupiedListingSlotKeys ?? [],
    availableListingSlotKeys: s.availableListingSlotKeys ?? [],
  }));

  const { calendarDays, timeSlotsByDay, slotCalendarDates } =
    availabilityFromDirectorySlotGroups(detail.slotGroups ?? []);

  const vitrineGallery = (detail.vitrineGalleryItems ?? []).map((it) => ({
    src: resolveDirectoryImageSrc(it.url),
    alt: it.alt?.trim() || detail.name,
  }));

  return {
    id: detail.id,
    name: detail.name,
    imageSrc,
    imageAlt: detail.name,
    rating: detail.rating,
    lat,
    lng,
    reviewsCount: detail.reviewsCount,
    phone: detail.phone ?? null,
    addressLine,
    yearsInBusiness: detail.yearsInBusiness ?? 0,
    clientsCount: detail.clientsCount,
    calendarDays,
    timeSlotsByDay,
    slotCalendarDates,
    specialists,
    vitrineGallery,
    ...(detail.publicationModerationStatus !== undefined &&
    detail.publicationModerationStatus !== "approved"
      ? { publicationModerationStatus: detail.publicationModerationStatus }
      : {}),
  };
}
