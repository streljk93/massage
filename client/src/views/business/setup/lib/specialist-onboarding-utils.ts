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
  if (n > 8) {
    return 8;
  }
  return n;
}

export {
  isPlausibleVnNational,
  parseVnLocalForInput,
  toE164Vietnam,
} from "@/shared/lib/vn-phone-contact";

export type { Cat } from "@/entities/specialists";
