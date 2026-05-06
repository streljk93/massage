/** Рубрика каталога для онбординга / формы салона / личных услуг. */
export type Cat = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  label: string;
};

export type DurPrice = { minutes: number; priceVnd: string };
export type SvcForm = {
  categoryId: string;
  kind: "standard" | "combo";
  comboCategoryIds: string[];
  bodyZoneSlugs: string[];
  durationPrices: DurPrice[];
};

/** Состояние хранит только цифры; в поле — группы по 3 с пробелом (500 000). */
export function formatVndPriceForInput(digits: string): string {
  const d = String(digits).replace(/\D/g, "");
  if (!d) {
    return "";
  }
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function digitsFromVndPriceInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function defaultSvc(catId: string): SvcForm {
  return {
    categoryId: catId,
    kind: "standard",
    comboCategoryIds: [],
    bodyZoneSlugs: [],
    durationPrices: [
      { minutes: 60, priceVnd: "" },
      { minutes: 90, priceVnd: "" },
    ],
  };
}

const DURATION_MINUTE_STEP_FALLBACK = 30;
/** Согласно API `POST /specialists/me/services` (Zod) и `input[min]`. */
export const DURATION_MINUTES_MIN = 15;
export const DURATION_MINUTES_MAX = 1440;

/** Следующая длительность: последняя + тот же шаг, что между предыдущей и последней. */
export function nextMinutesWhenAddingDuration(durations: DurPrice[]): number {
  const n = durations.length;
  if (n < 1) {
    return 60;
  }
  const last = durations[n - 1]!.minutes;
  let next: number;
  if (n >= 2) {
    const prev = durations[n - 2]!.minutes;
    const step = last - prev;
    if (step > 0) {
      next = last + step;
    } else {
      next = last + DURATION_MINUTE_STEP_FALLBACK;
    }
  } else {
    next = last + DURATION_MINUTE_STEP_FALLBACK;
  }
  return Math.min(DURATION_MINUTES_MAX, Math.max(DURATION_MINUTES_MIN, next));
}
