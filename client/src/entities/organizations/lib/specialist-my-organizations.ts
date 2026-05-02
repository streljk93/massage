import type { AppLocale } from "@/app/i18n/routing";
import type { SpecialistsCabinetGetSpecialistMyOrganizationsResponse } from "@/shared/api/generated/sdk/types.gen";
import { previewSrcForPersistedGalleryUrl } from "@/shared/lib";

export const SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX = [
  "specialistMyOrganizations",
] as const;

export function specialistMyOrganizationsQueryKey(
  accessToken: string,
  locale: AppLocale,
) {
  return [...SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX, accessToken, locale] as const;
}

export type SpecialistMyOrganizationRow =
  SpecialistsCabinetGetSpecialistMyOrganizationsResponse["organizations"][number];

export function displayNameForCabinetOrganization(org: {
  name: string;
  salonCabinetPreview: { name: string } | null;
}): string {
  const draft = org.salonCabinetPreview;
  return draft != null && draft.name.trim().length > 0 ? draft.name : org.name;
}

export function cabinetOrganizationCoverSrc(org: SpecialistMyOrganizationRow): string | null {
  const draft = org.salonCabinetPreview;
  const persisted =
    draft?.coverImageUrl != null ? draft.coverImageUrl
    : org.publishedCoverImageUrl != null ? org.publishedCoverImageUrl
    : null;
  return persisted != null ? previewSrcForPersistedGalleryUrl(persisted) : null;
}

export function pickActiveWorkplaceOrganization(
  data: SpecialistsCabinetGetSpecialistMyOrganizationsResponse | undefined,
): SpecialistMyOrganizationRow | null {
  if (data == null || data.organizations.length === 0) {
    return null;
  }
  const aid =
    typeof data.activeOrganizationId === "string" && data.activeOrganizationId.length > 0 ?
      data.activeOrganizationId
    : null;
  if (aid == null) {
    return null;
  }
  return (
    data.organizations.find(
      (o) =>
        o.id === aid &&
        o.membershipStatus === "employed",
    ) ?? null
  );
}
