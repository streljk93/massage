import { parseVnLocalForInput } from "@/shared/lib/vn-phone-contact";

function formatVnNationalGrouped(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (!d) {
    return "";
  }
  const parts: string[] = [];
  let i = 0;
  const firstLen = d.length % 3 === 0 ? 3 : d.length % 3;
  parts.push(d.slice(i, i + firstLen));
  i += firstLen;
  while (i < d.length) {
    parts.push(d.slice(i, i + 3));
    i += 3;
  }
  return parts.filter(Boolean).join(" ");
}

export function displaySpecialistCabinetPhone(
  userPhone: string | null | undefined,
): string {
  if (!userPhone?.trim()) {
    return "";
  }
  const national = parseVnLocalForInput(userPhone);
  if (!national) {
    return userPhone.trim();
  }
  return `+84 ${formatVnNationalGrouped(national)}`.trim();
}
