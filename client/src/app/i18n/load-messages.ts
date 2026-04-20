import { bookingCardI18n } from "@/entities/booking";
import { organizationCardI18n } from "@/entities/organizations";
import { categoryCardI18n } from "@/entities/services";
import { specialistCardI18n } from "@/entities/specialists";
import { metaI18n } from "@/shared/model";
import { availabilitySlotStripI18n } from "@/shared/ui";
import { homePageI18n } from "@/views/home";
import { searchPageI18n } from "@/views/search";
import {
  homeBottomNavI18n,
  homeScreenHeaderI18n,
} from "@/widgets/home";
import { homeIntroI18n } from "@/widgets/home-intro";
import type { ColocatedI18nBundle } from "./types";
import { mergeBundlesForLocale } from "./merge-messages";

/** Порядок важен при конфликте ключей: последний выигрывает. */
const bundles: ColocatedI18nBundle[] = [
  metaI18n,
  availabilitySlotStripI18n,
  homeBottomNavI18n,
  homeScreenHeaderI18n,
  homePageI18n,
  categoryCardI18n,
  bookingCardI18n,
  searchPageI18n,
  organizationCardI18n,
  specialistCardI18n,
  homeIntroI18n,
];

export function loadMessagesForLocale(locale: string): Record<string, unknown> {
  return mergeBundlesForLocale(locale, bundles);
}
