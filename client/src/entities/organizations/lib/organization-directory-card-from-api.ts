import type {
  OrganizationsGetByIdResponse,
  OrganizationsListResponse,
} from "@/shared/api";
import type { DirectorySlotGroupSeed } from "@/shared/lib/directory-slot-group-seed";
import { resolveDirectoryImageSrc } from "@/shared/lib/directory-card-image";

export type OrganizationDirectoryCardSource =
  | OrganizationsListResponse["organizations"][number]
  | OrganizationsGetByIdResponse;

export type OrganizationCardSeedFromApi = {
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

export function organizationCardSeedFromApi(
  o: OrganizationDirectoryCardSource,
): OrganizationCardSeedFromApi {
  return {
    id: o.id,
    name: o.name,
    lat: o.latitude ?? 0,
    lng: o.longitude ?? 0,
    imageSrc: resolveDirectoryImageSrc(o.imageUrl),
    rating: o.rating,
    metaLine: o.metaLine,
    servicesLine: o.servicesLine,
    slotGroups: (o.slotGroups ?? []) as DirectorySlotGroupSeed[],
    categories: o.categories ?? [],
    addressLine: o.addressLine ?? null,
    city: o.city ?? null,
  };
}

export { resolveDirectoryImageSrc } from "@/shared/lib/directory-card-image";
