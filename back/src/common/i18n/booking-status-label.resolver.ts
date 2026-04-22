import type { BookingStatus } from '@prisma/client';
import type { ApiLocale } from './api-locale';
import { resolveLocalizedString } from './locale-table.resolver';

type StatusLocaleRow = { locale: string; label: string };

/**
 * Группирует строки `BookingStatusLocale` по коду статуса для {@link pickBookingStatusLabel}.
 */
export function buildBookingStatusLabelMap(
  rows: { status: BookingStatus; locale: string; label: string }[],
): Map<BookingStatus, StatusLocaleRow[]> {
  const m = new Map<BookingStatus, StatusLocaleRow[]>();
  for (const r of rows) {
    const list = m.get(r.status) ?? [];
    list.push({ locale: r.locale, label: r.label });
    m.set(r.status, list);
  }
  return m;
}

/**
 * Подпись статуса для ответа API: запрошенная локаль → en → fallback (`status` как строка).
 */
export function pickBookingStatusLabel(
  status: BookingStatus,
  locale: ApiLocale,
  labelMap: Map<BookingStatus, StatusLocaleRow[]>,
): string {
  const rows = labelMap.get(status) ?? [];
  return resolveLocalizedString(locale, rows, (r) => r.label, status);
}
