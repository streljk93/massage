/**
 * Очередь команд брони (BullMQ): при `lock_timeout` на advisory-lock слота
 * HTTP может поставить job вместо потери намерения. Включается явно.
 */
export function isBookingCommandQueueEnabled(): boolean {
  return process.env.BOOKING_COMMAND_QUEUE_ENABLED === 'true';
}
