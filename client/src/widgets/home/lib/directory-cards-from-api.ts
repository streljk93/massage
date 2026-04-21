import type {
  OrganizationsListResponse,
  SpecialistsListResponse,
} from "@/shared/api";
import { resolveApiResourceUrl } from "@/shared/api/resolve-api-resource-url";
import type { SlotGroupSeed } from "./mock-data";

const FALLBACK_CARD_IMAGE = "/massage.png";

export function resolveDirectoryImageSrc(
  imageUrl: string | null | undefined,
): string {
  if (!imageUrl) {
    return FALLBACK_CARD_IMAGE;
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  return resolveApiResourceUrl(
    imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`,
  );
}

export type SpecialistCardSeedFromApi = {
  id: string;
  name: string;
  imageSrc: string;
  rating: number;
  metaLine: string;
  servicesLine: string;
  slotGroups: SlotGroupSeed[];
  /** WGS84 — карта / расстояния. */
  lat: number;
  lng: number;
  /** Выбранные подкатегории каталога (локализованный shortName). */
  categories: { slug: string; shortName: string }[];
  /** Адрес приёма (если задан). */
  addressLine: string | null;
  city: string | null;
};

export type OrganizationCardSeedFromApi = SpecialistCardSeedFromApi;

export function specialistCardSeedFromApi(
  s: SpecialistsListResponse["specialists"][number],
): SpecialistCardSeedFromApi {
  return {
    id: s.id,
    name: s.name,
    imageSrc: resolveDirectoryImageSrc(s.imageUrl),
    rating: s.rating,
    metaLine: s.metaLine,
    servicesLine: s.servicesLine,
    slotGroups: (s.slotGroups ?? []) as SlotGroupSeed[],
    lat: s.latitude ?? 0,
    lng: s.longitude ?? 0,
    categories: s.categories ?? [],
    addressLine: s.addressLine ?? null,
    city: s.city ?? null,
  };
}

export function organizationCardSeedFromApi(
  o: OrganizationsListResponse["organizations"][number],
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
    slotGroups: (o.slotGroups ?? []) as SlotGroupSeed[],
    categories: o.categories ?? [],
    addressLine: o.addressLine ?? null,
    city: o.city ?? null,
  };
}
