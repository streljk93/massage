/**
 * Укрупнённое состояние машины переходов (не enum в БД), выводится reducer-ом из `BookingEvent`.
 */
export type BookingCoarseState =
  | null
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'canceled'
  | 'rejected'
  | 'expired'
  | 'no_show';
