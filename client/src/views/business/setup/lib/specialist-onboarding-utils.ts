export type { ExperienceKey } from "@/entities/specialists/lib/specialist-experience-range";
export {
  EXP_ORDER,
  keyToYears,
  yearsToKey,
} from "@/entities/specialists/lib/specialist-experience-range";

export function clampUi(n: number): number {
  if (Number.isNaN(n) || n < 1) {
    return 1;
  }
  if (n > 5) {
    return 5;
  }
  return n;
}

export {
  isPlausibleVnNational,
  parseVnLocalForInput,
  toE164Vietnam,
} from "@/shared/lib/vn-phone-contact";

export type { Cat, DurPrice, SvcForm } from "@/entities/specialists/lib/personal-service-catalog-draft";
export {
  defaultSvc,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  digitsFromVndPriceInput,
  formatVndPriceForInput,
  nextMinutesWhenAddingDuration,
} from "@/entities/specialists/lib/personal-service-catalog-draft";
