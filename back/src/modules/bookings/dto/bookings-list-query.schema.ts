import { z } from 'zod';
import { BOOKING_STATUS_ALL_ORDERED } from '../domain/booking-status-all-ordered';

/** `z.enum` ждёт мутабельный `[T, ...T[]]`; константа домена — `readonly`. */
const bookingStatusEnum = z.enum(
  BOOKING_STATUS_ALL_ORDERED as unknown as [
    (typeof BOOKING_STATUS_ALL_ORDERED)[number],
    ...(typeof BOOKING_STATUS_ALL_ORDERED)[number][],
  ],
);

/**
 * Приводит сырое значение статуса из query к массиву строк или `undefined`.
 * — Повтор `?status=a&status=b` → массив.
 * — `?status[]=a&status[]=b` в Express попадает в ключ `status[]`, не в `status`.
 * — Иногда qs отдаёт «массив» как объект с числовыми ключами.
 */
function normalizeStatusQueryInput(val: unknown): unknown {
  if (val === undefined || val === '') {
    return undefined;
  }
  if (Array.isArray(val)) {
    return val.filter((v): v is string => typeof v === 'string' && v !== '');
  }
  if (typeof val === 'string') {
    return [val];
  }
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    const keys = Object.keys(o).sort((a, b) => Number(a) - Number(b));
    if (keys.length > 0 && keys.every((k) => /^(?:0|[1-9]\d*)$/.test(k))) {
      return keys
        .map((k) => o[k])
        .filter((v): v is string => typeof v === 'string' && v !== '');
    }
  }
  return undefined;
}

/**
 * Query `GET /bookings`: опциональная фильтрация по списку статусов в БД.
 * Целиком обрабатываем объект query: учитываем и `status`, и `status[]` (скобочная форма).
 */
export const bookingsListQuerySchema = z.preprocess(
  (input) => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return { status: undefined };
    }
    const raw = input as Record<string, unknown>;
    const statusRaw = raw.status !== undefined ? raw.status : raw['status[]'];
    return {
      status: normalizeStatusQueryInput(statusRaw),
    };
  },
  z.object({
    status: z.array(bookingStatusEnum).min(1).optional(),
  }),
);

export type BookingsListQuery = z.infer<typeof bookingsListQuerySchema>;
