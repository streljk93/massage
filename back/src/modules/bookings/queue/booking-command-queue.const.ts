/** Имя очереди: создание брони и перенос при перегрузке lock. */
export const BOOKING_COMMAND_QUEUE = 'booking-command';

/** Payload: клиент создаёт бронь (идемпотентность по заголовку). */
export const BOOKING_COMMAND_JOB_CLIENT_CREATE = 'client_booking_create';

/** Payload: мастер/салон переносит подтверждённую бронь. */
export const BOOKING_COMMAND_JOB_SPECIALIST_RESCHEDULE =
  'specialist_reschedule_confirmed';
