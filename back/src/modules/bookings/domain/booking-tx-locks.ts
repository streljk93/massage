import type { Prisma } from '@prisma/client';

import {
  bookingAggregateAdvisoryLockKeys,
  clientBookingCreateIdempotencyAdvisoryLockKeys,
  pgAdvisoryXactLockPair,
  setSessionLockTimeoutMs,
  specialistListingSlotAdvisoryLockKeys,
} from './booking-advisory-lock';

/**
 * «Lock context» для домена брони: только вызовы с переданным `tx` **одной** Prisma `$transaction`.
 * Не singleton Nest, не AsyncLocalStorage без `tx` — иначе ложное ощущение удержания lock между запросами.
 *
 * См. план v14: overlap / сериализация append только под реальной DB-блокировкой в scope TX.
 */
export const BookingTxLocks = {
  setLockTimeoutMsForThisTransaction: setSessionLockTimeoutMs,

  async acquireAggregateAppend(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ): Promise<void> {
    await pgAdvisoryXactLockPair(tx, bookingAggregateAdvisoryLockKeys(bookingId));
  },

  async acquireSpecialistActiveSlotExclusion(
    tx: Prisma.TransactionClient,
    specialistId: string,
  ): Promise<void> {
    await pgAdvisoryXactLockPair(
      tx,
      specialistListingSlotAdvisoryLockKeys(specialistId),
    );
  },

  async acquireClientCreateIdempotency(
    tx: Prisma.TransactionClient,
    args: { clientUserId: string; idempotencyKey: string },
  ): Promise<void> {
    await pgAdvisoryXactLockPair(
      tx,
      clientBookingCreateIdempotencyAdvisoryLockKeys(args),
    );
  },
} as const;
