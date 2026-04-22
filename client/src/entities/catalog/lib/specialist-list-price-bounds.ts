import type { SpecialistsListResponse } from "@/shared/api";

const MIN_SPAN_WHEN_FLAT = 50_000;

/**
 * Min/max price over all `bookableServices` in the list (VND from API).
 * If all prices are equal, `max` is bumped so a range slider can move.
 */
export function specialistListPriceBounds(
  specialists: SpecialistsListResponse["specialists"],
): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of specialists) {
    for (const svc of s.bookableServices) {
      for (const p of svc.priceVndByDuration) {
        if (p < min) min = p;
        if (p > max) max = p;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    return { min, max: min + MIN_SPAN_WHEN_FLAT };
  }
  return { min, max };
}

export function priceSliderStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 1;
  if (span <= 200_000) return 10_000;
  if (span <= 2_000_000) return 50_000;
  return 100_000;
}

export function specialistHasPriceInRange(
  specialist: SpecialistsListResponse["specialists"][0],
  range: { min: number; max: number },
): boolean {
  for (const svc of specialist.bookableServices) {
    for (const p of svc.priceVndByDuration) {
      if (p >= range.min && p <= range.max) return true;
    }
  }
  return false;
}
