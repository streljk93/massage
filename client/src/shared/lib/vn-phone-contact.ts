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
