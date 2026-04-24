/** Диапазон как в URL `radiusM` (search-url-filters). */
export const RADIUS_M_SLIDER_MIN = 100;
export const RADIUS_M_SLIDER_MAX = 500_000;

/** Квантование для стабильного бегунка. */
const QUANT = 25;

/**
 * Лог-шкала 0…1000 → метры, чтобы слабо менять километры и плотно — сотни метров.
 */
export function radiusLogStepFromMeters(m: number): number {
  if (m <= RADIUS_M_SLIDER_MIN) {
    return 0;
  }
  if (m >= RADIUS_M_SLIDER_MAX) {
    return 1000;
  }
  const t =
    (Math.log(m) - Math.log(RADIUS_M_SLIDER_MIN)) /
    (Math.log(RADIUS_M_SLIDER_MAX) - Math.log(RADIUS_M_SLIDER_MIN));
  return Math.round(t * 1000);
}

export function radiusMetersFromLogStep(s: number): number {
  const t = s / 1000;
  const m =
    RADIUS_M_SLIDER_MIN *
    (RADIUS_M_SLIDER_MAX / RADIUS_M_SLIDER_MIN) ** t;
  const r = Math.round(m / QUANT) * QUANT;
  return Math.min(
    RADIUS_M_SLIDER_MAX,
    Math.max(RADIUS_M_SLIDER_MIN, r),
  );
}
