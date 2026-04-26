/**
 * Ссылка `tel:` для набора с устройства. Пусто — если в строке нет достаточно цифр.
 */
export function telHrefFromDisplayPhone(
  phone: string | null | undefined,
): string | null {
  if (phone == null) {
    return null;
  }
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  let core = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch >= "0" && ch <= "9") {
      core += ch;
    } else if (ch === "+" && core.length === 0) {
      core += ch;
    }
  }
  if (core.startsWith("+")) {
    const digits = core.slice(1).replace(/\D/g, "");
    if (digits.length < 5) {
      return null;
    }
    return `tel:+${digits}`;
  }
  if (core.length < 5) {
    return null;
  }
  return `tel:${core}`;
}
