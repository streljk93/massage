/** Ввод суммы в VND: только цифры, отображение группами по 3 (например 100 000, 5 000 000). */

const MAX_VND_INPUT_DIGITS = 15;

function groupDigitsWithAsciiSpaces(digits: string): string {
  if (digits.length === 0) return "";
  const rev = [...digits].reverse();
  const groups: string[] = [];
  for (let i = 0; i < rev.length; i += 3) {
    groups.push(rev.slice(i, i + 3).reverse().join(""));
  }
  return groups.reverse().join(" ");
}

/**
 * Нормализует сырое значение поля (вставка, ввод) в строку для отображения с пробелами.
 */
export function formatVndAmountInputDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, MAX_VND_INPUT_DIGITS);
  return groupDigitsWithAsciiSpaces(digits);
}

/**
 * Целое VND из текста поля (пробелы и прочие нецифровые символы отбрасываются).
 */
export function parseVndAmountInputToInt(displayOrRaw: string): number | null {
  const d = displayOrRaw.replace(/\D/g, "");
  if (d.length === 0) return null;
  return Number.parseInt(d, 10);
}

/** Стабильная подпись VND для SSR/CSR (ASCII-пробелы, символ ₫). */
export function formatVndListingLabel(amount: number): string {
  const digits = Math.max(0, Math.round(amount)).toString();
  return `${groupDigitsWithAsciiSpaces(digits)} ₫`;
}
