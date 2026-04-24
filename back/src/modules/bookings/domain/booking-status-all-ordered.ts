import type { BookingStatus } from '@prisma/client';

/**
 * Полный набор статусов брони в удобном для UI порядке.
 * @see `.cursor/rules/business-logic.mdc`
 * @see `booking-status-transitions.ts` — допустимые переходы между статусами
 * @see `BookingStatus` в `schema.prisma`
 */
export const BOOKING_STATUS_ALL_ORDERED = [
  'pending',
  'expired',
  'reject_by_master',
  'reject_by_client',
  'confirmed',
  'canceled_by_master',
  'canceled_by_client',
  'no_show_by_client',
  'no_show_by_master',
  'in_progress',
  'done',
] as const;

type AllListed = (typeof BOOKING_STATUS_ALL_ORDERED)[number];

/** Все значения Prisma перечислены и лишних строк нет. */
type _ExhaustiveStatuses = [
  BookingStatus extends AllListed ? true : never,
  AllListed extends BookingStatus ? true : never,
];

const _bookingStatusListExhaustive: _ExhaustiveStatuses = [true, true];
void _bookingStatusListExhaustive;

/**
 * Подписи к значениям enum в Swagger (`x-enum-descriptions`), тот же порядок, что
 * {@link BOOKING_STATUS_ALL_ORDERED}.
 */
export const BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS = [
  'Клиент записался; ждёт подтверждения специалиста или организации',
  'Истекло окно подтверждения — автоотмена слота',
  'Отклонил мастер или уполномоченное лицо организации',
  'Клиент отменил запись',
  'Запись подтверждена',
  'После подтверждения: отмена мастером/организацией (с причиной)',
  'После подтверждения: отмена клиентом (с причиной)',
  'Клиент не пришёл (таймаут ожидания или отмена в окне визита)',
  'Мастер отменил в окне ожидания визита',
  'Услуга выполняется',
  'Услуга завершена; возможен отзыв',
] as const;

type _DescCountMatchesStatuses =
  (typeof BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS)['length'] extends (typeof BOOKING_STATUS_ALL_ORDERED)['length']
    ? true
    : never;

const _swaggerDescCount: _DescCountMatchesStatuses = true;
void _swaggerDescCount;
