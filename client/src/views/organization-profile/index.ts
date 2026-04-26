export { default as organizationProfilePageI18n } from "./model/organization-profile-page.i18n.json";
export { default as organizationDetailsPageI18n } from "./model/organization-details-page.i18n.json";
export { OrganizationProfilePage } from "./ui/organization-profile-page";
export type { OrganizationProfilePageProps } from "./ui/organization-profile-page";
export { OrganizationDetailsPage } from "./ui/organization-details-page";
export type {
  OrganizationDetailsPageProps,
  OrganizationDetailsStaffItem,
} from "./ui/organization-details-page";
export type { OrganizationProfileData } from "./model/organization-profile-data";
export { organizationProfileFromApiDetail } from "./lib/organization-profile-from-api";
