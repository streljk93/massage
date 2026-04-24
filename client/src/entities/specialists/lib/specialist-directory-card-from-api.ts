import type {
  SpecialistsGetByIdResponse,
  SpecialistsListResponse,
} from "@/shared/api";
import {
  freeDirectorySlotGroupSeedsFromSpecialistOccupied,
  UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
} from "@/shared/lib/directory-free-slot-groups-from-occupied";
import { normalizeClientListingWorkday } from "@/shared/lib/directory-listing-workday";
import type { DirectorySlotGroupSeed } from "@/shared/lib/directory-slot-group-seed";
import { resolveDirectoryImageSrc } from "@/shared/lib/directory-card-image";

export type SpecialistDirectoryCardSource =
  | SpecialistsListResponse["specialists"][number]
  | SpecialistsGetByIdResponse;

export type SpecialistCardSeedFromApi = {
  id: string;
  name: string;
  imageSrc: string;
  rating: number;
  metaLine: string;
  servicesLine: string;
  slotGroups: DirectorySlotGroupSeed[];
  lat: number;
  lng: number;
  categories: { slug: string; shortName: string }[];
  addressLine: string | null;
  city: string | null;
};

export function specialistCardSeedFromApi(
  s: SpecialistDirectoryCardSource,
  now: Date = new Date(),
): SpecialistCardSeedFromApi {
  const occupied = (s.slotGroups ?? []) as DirectorySlotGroupSeed[];
  const workday = normalizeClientListingWorkday(
    s.listingWorkdayStartMinute,
    s.listingWorkdayEndMinute,
  );
  return {
    id: s.id,
    name: s.name,
    imageSrc: resolveDirectoryImageSrc(s.imageUrl),
    rating: s.rating,
    metaLine: s.metaLine,
    servicesLine: s.servicesLine,
    slotGroups: freeDirectorySlotGroupSeedsFromSpecialistOccupied(
      occupied,
      now,
      UNIFIED_DIRECTORY_SLOT_PREVIEW_CALENDAR_DAYS,
      workday,
    ),
    lat: s.latitude ?? 0,
    lng: s.longitude ?? 0,
    categories: s.categories ?? [],
    addressLine: s.addressLine ?? null,
    city: s.city ?? null,
  };
}
