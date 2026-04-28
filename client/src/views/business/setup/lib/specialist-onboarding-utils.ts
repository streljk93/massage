export type ExperienceKey = "0-1" | "1-3" | "3-5" | "5+";

export const EXP_ORDER: readonly ExperienceKey[] = ["0-1", "1-3", "3-5", "5+"];

export function yearsToKey(y: number | null | undefined): ExperienceKey | null {
  if (y == null) {
    return null;
  }
  if (y <= 1) {
    return "0-1";
  }
  if (y <= 3) {
    return "1-3";
  }
  if (y <= 5) {
    return "3-5";
  }
  return "5+";
}

export function keyToYears(k: ExperienceKey): number {
  if (k === "0-1") {
    return 0;
  }
  if (k === "1-3") {
    return 2;
  }
  if (k === "3-5") {
    return 4;
  }
  return 6;
}

export function clampUi(n: number): number {
  if (Number.isNaN(n) || n < 1) {
    return 1;
  }
  if (n > 5) {
    return 5;
  }
  return n;
}

/** Показанная без +84 национальная часть; из ответа API (E.164 и т.д.). */
export function parseVnLocalForInput(phone: string | null | undefined): string {
  if (!phone?.trim()) {
    return "";
  }
  let t = phone.trim().replace(/\s/g, "");
  if (t.startsWith("+84")) {
    t = t.slice(3);
  } else if (t.startsWith("84") && t.length > 2) {
    t = t.slice(2);
  }
  return t.replace(/\D/g, "");
}

/** E.164 для Вьетнама из введённых цифр (код +84 фиксирован). */
export function toE164Vietnam(nationalDigits: string): string {
  let d = nationalDigits.replace(/\D/g, "");
  if (d.startsWith("0") && d.length >= 2) {
    d = d.slice(1);
  }
  if (d.startsWith("84") && d.length > 2) {
    d = d.slice(2);
  }
  return `+84${d}`;
}

export function isPlausibleVnNational(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 12;
}

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

export type Cat = { id: string; slug: string; label: string };

export type DurPrice = { minutes: number; priceVnd: string };
export type SvcForm = { categoryId: string; durationPrices: DurPrice[] };

export function defaultSvc(catId: string): SvcForm {
  return {
    categoryId: catId,
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
