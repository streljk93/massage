import {
  bookingCardI18n,
  bookingHistoryCardI18n,
  bookingListCardI18n,
} from "@/entities/booking";
import { catalogFiltersDialogI18n } from "@/entities/catalog";
import { organizationCardI18n } from "@/entities/organizations";
import { categoryCardI18n } from "@/entities/services";
import { specialistCardI18n } from "@/entities/specialists";
import { comingSoonI18n } from "@/features/coming-soon";
import { fcmInAppI18n } from "@/features/push-notifications";
import { apiErrorToastI18n, metaI18n } from "@/shared/model";
import { availabilitySlotStripI18n } from "@/shared/ui";
import { authLoginPageI18n, authRegisterPageI18n } from "@/views/auth";
import { bookingCancelDialogI18n, bookingsPageI18n } from "@/views/bookings";
import { becomeSpecialistPageI18n } from "@/views/become-specialist";
import { homePageI18n } from "@/views/home";
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
import { organizationProfilePageI18n } from "@/views/organization-profile";
import { specialistProfilePageI18n } from "@/views/specialist-profile";
import { searchMapPageI18n, searchPageI18n } from "@/views/search";
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
  availabilitySlotStripI18n,
  homeBottomNavI18n,
  homeScreenHeaderI18n,
  homePageI18n,
  becomeSpecialistPageI18n,
  authLoginPageI18n,
  authRegisterPageI18n,
  categoryCardI18n,
  bookingCardI18n,
  bookingListCardI18n,
  bookingHistoryCardI18n,
  bookingCancelDialogI18n,
  bookingsPageI18n,
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
  searchPageI18n,
  searchMapPageI18n,
  specialistProfilePageI18n,
  organizationProfilePageI18n,
  organizationCardI18n,
  specialistCardI18n,
];

export function loadMessagesForLocale(locale: string): Record<string, unknown> {
  return mergeBundlesForLocale(locale, bundles);
}
