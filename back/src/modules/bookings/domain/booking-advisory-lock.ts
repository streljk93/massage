import { Prisma } from '@prisma/client';

/** Двойной int4 для {@link pgAdvisoryXactLockPair} (ключ не глобально уникален, достаточно для снижения коллизий). */
export function twoPartFnv1a32(input: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return [h & 0xffff, (h >>> 16) & 0xffff];
}

export function specialistListingSlotAdvisoryLockKeys(
  specialistId: string,
): [number, number] {
  return twoPartFnv1a(`specialist_slot:${specialistId}`);
}

export function bookingAggregateAdvisoryLockKeys(
  bookingId: string,
): [number, number] {
  return twoPartFnv1a(`booking_agg:${bookingId}`);
}

export function clientBookingCreateIdempotencyAdvisoryLockKeys(args: {
  clientUserId: string;
  idempotencyKey: string;
}): [number, number] {
  return twoPartFnv1a(
    `booking_create_idem:${args.clientUserId}\n${args.idempotencyKey}`,
  );
}

function twoPartFnv1a(s: string): [number, number] {
  return twoPartFnv1a32(s);
}

export async function pgAdvisoryXactLockPair(
  tx: Prisma.TransactionClient,
  keys: [number, number],
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${keys[0]}::int4, ${keys[1]}::int4)`;
}

export async function setSessionLockTimeoutMs(
  tx: Prisma.TransactionClient,
  ms: number,
): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }
  await tx.$executeRawUnsafe(
    `SELECT set_config('lock_timeout', ${Math.floor(ms)}::text, true)`,
  );
}
