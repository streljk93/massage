/** Таймаут advisory/pg lock (`lock_timeout`) — клиент должен повторить с тем же idempotency key. */
export function isPostgresLockTimeoutError(e: unknown): boolean {
  if (e == null || typeof e !== 'object') {
    return false;
  }
  const msg = String((e as Error).message ?? '');
  return (
    msg.toLowerCase().includes('lock timeout') ||
    msg.toLowerCase().includes('canceling statement due to lock timeout')
  );
}

/** Нарушение EXCLUDE (пересечение активных слотов), часто код 23P01. */
export function isExclusionConstraintViolation(e: unknown): boolean {
  if (e == null || typeof e !== 'object') {
    return false;
  }
  const any = e as { code?: string; message?: string };
  const msg = String(any.message ?? '');
  return (
    any.code === '23P01' ||
    msg.includes('23P01') ||
    msg.toLowerCase().includes('exclusion constraint') ||
    msg.includes('Booking_active_slot_excl')
  );
}
