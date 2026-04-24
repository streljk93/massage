import type {
  OrganizationsListResponse,
  SpecialistsListResponse,
} from "@/shared/api";
import { organizationCardSeedFromApi } from "@/entities/organizations";
import { specialistCardSeedFromApi } from "@/entities/specialists";

/** Точка и карточка для карты поиска (маркер + слайдер). */
export type SearchMapListItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  imageSrc: string;
  rating: number;
  metaLine: string;
};

function hasValidCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export function searchMapOrganizationsFromApi(
  organizations:
    | OrganizationsListResponse["organizations"]
    | null
    | undefined,
): SearchMapListItem[] {
  if (!organizations?.length) return [];
  const out: SearchMapListItem[] = [];
  for (const o of organizations) {
    const c = organizationCardSeedFromApi(o);
    if (!hasValidCoords(c.lat, c.lng)) continue;
    out.push({
      id: c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      imageSrc: c.imageSrc,
      rating: c.rating,
      metaLine: c.metaLine,
    });
  }
  return out;
}

export function searchMapSpecialistsFromApi(
  specialists: SpecialistsListResponse["specialists"] | null | undefined,
): SearchMapListItem[] {
  if (!specialists?.length) return [];
  const out: SearchMapListItem[] = [];
  for (const s of specialists) {
    const c = specialistCardSeedFromApi(s);
    if (!hasValidCoords(c.lat, c.lng)) continue;
    out.push({
      id: c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      imageSrc: c.imageSrc,
      rating: c.rating,
      metaLine: c.metaLine,
    });
  }
  return out;
}
