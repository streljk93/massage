import {
  bookingCardI18n,
  bookingDoneVisitReviewSummaryI18n,
  bookingHistoryCardI18n,
  bookingListCardI18n,
} from "@/entities/booking";
import { catalogFiltersDialogI18n } from "@/entities/catalog";
import { bodyZonesSelectorI18n } from "@/entities/body-zones";
import {
  businessActiveOrganizationContextCardI18n,
  organizationCardI18n,
} from "@/entities/organizations";
import {
  categoryCardI18n,
  profileServiceSphereChipsI18n,
  serviceCategorySkillsPickerI18n,
} from "@/entities/services";
import { specialistCardI18n } from "@/entities/specialists";
import { comingSoonI18n } from "@/features/coming-soon";
import { fcmInAppI18n } from "@/features/push-notifications";
import { apiErrorToastI18n, metaI18n } from "@/shared/model";
import { availabilitySlotStripI18n } from "@/shared/ui";
import { authLoginPageI18n, authRegisterPageI18n } from "@/views/auth";
import {
  bookingCancelDialogI18n,
  bookingsPageI18n,
  visitRatePageI18n,
} from "@/views/bookings";
import {
  businessAppSubpagesI18n,
  businessOrganizationOfferingsPageI18n,
  businessSkillsPageI18n,
} from "@/views/business/subpages";
import { businessOnboardingPageI18n } from "@/views/business/onboarding";
import {
  specialistAccountSetupPageI18n,
  specialistOnboardingWizardI18n,
} from "@/views/business/setup";
import { becomeSpecialistPageI18n } from "@/views/become-specialist";
import { homeForYouSectionI18n, homePageI18n } from "@/views/home";
import {
  profileEditPageI18n,
  profileFavoritesPageI18n,
  profileHelpPageI18n,
  profileLanguagePageI18n,
  profileLocationPageI18n,
  profileNotificationsPageI18n,
  profilePageI18n,
  profilePaymentPageI18n,
  profileSubpageShellI18n,
  profileTermsPageI18n,
  profileThemePageI18n,
} from "@/views/profile";
import { entityReviewsPageI18n } from "@/views/entity-reviews";
import {
  organizationDetailsPageI18n,
  organizationProfilePageI18n,
} from "@/views/organization-profile";
import {
  specialistDetailsPageI18n,
  specialistProfilePageI18n,
} from "@/views/specialist-profile";
import { adminPageI18n } from "@/views/admin";
import { searchMapPageI18n, searchPageI18n } from "@/views/search";
import { addressMapPickerDialogI18n } from "@/widgets/address-map-picker";
import {
  businessAppBottomNavI18n,
  businessScreenHeaderI18n,
} from "@/widgets/business/chrome";
import {
  homeBottomNavI18n,
  homeScreenHeaderI18n,
} from "@/widgets/home";
import type { ColocatedI18nBundle } from "./types";
import { mergeBundlesForLocale } from "./merge-messages";

/** Порядок важен при конфликте ключей: последний выигрывает. */
const bundles: ColocatedI18nBundle[] = [
  metaI18n,
  apiErrorToastI18n,
  comingSoonI18n,
  fcmInAppI18n,
  addressMapPickerDialogI18n,
  availabilitySlotStripI18n,
  homeBottomNavI18n,
  homeScreenHeaderI18n,
  businessAppBottomNavI18n,
  businessScreenHeaderI18n,
  homePageI18n,
  homeForYouSectionI18n,
  businessOnboardingPageI18n,
  specialistAccountSetupPageI18n,
  specialistOnboardingWizardI18n,
  businessAppSubpagesI18n,
  businessOrganizationOfferingsPageI18n,
  businessSkillsPageI18n,
  becomeSpecialistPageI18n,
  authLoginPageI18n,
  authRegisterPageI18n,
  categoryCardI18n,
  profileServiceSphereChipsI18n,
  serviceCategorySkillsPickerI18n,
  bookingCardI18n,
  bookingListCardI18n,
  bookingHistoryCardI18n,
  bookingDoneVisitReviewSummaryI18n,
  bookingCancelDialogI18n,
  bookingsPageI18n,
  visitRatePageI18n,
  profilePageI18n,
  profileFavoritesPageI18n,
  profileSubpageShellI18n,
  profileEditPageI18n,
  profileLanguagePageI18n,
  profileLocationPageI18n,
  profileNotificationsPageI18n,
  profilePaymentPageI18n,
  profileHelpPageI18n,
  profileTermsPageI18n,
  profileThemePageI18n,
  catalogFiltersDialogI18n,
  bodyZonesSelectorI18n,
  searchPageI18n,
  searchMapPageI18n,
  specialistProfilePageI18n,
  specialistDetailsPageI18n,
  entityReviewsPageI18n,
  organizationProfilePageI18n,
  organizationDetailsPageI18n,
  organizationCardI18n,
  businessActiveOrganizationContextCardI18n,
  specialistCardI18n,
  adminPageI18n,
];

export function loadMessagesForLocale(locale: string): Record<string, unknown> {
  return mergeBundlesForLocale(locale, bundles);
}
