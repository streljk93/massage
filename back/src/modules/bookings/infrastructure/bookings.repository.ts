import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT } from '../domain/booking-cancel-reason';

const bookingListInclude = {
  specialist: {
    include: {
      user: { select: { name: true } },
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingListRow = Prisma.BookingGetPayload<{
  include: typeof bookingListInclude;
}>;

const ACTIVE_BOOKING_STATUSES: Array<'pending' | 'confirmed' | 'in_progress'> =
  ['pending', 'confirmed', 'in_progress'];

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Есть ли активная бронь, пересекающаяся с [startsAt, endsAt).
   */
  findActiveOverlap(
    specialistId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<{ id: string } | null> {
    return this.prisma.booking.findFirst({
      where: {
        specialistId,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
  }

  findManyForClient(clientUserId: string): Promise<BookingListRow[]> {
    return this.prisma.booking.findMany({
      where: { clientUserId, deletedAt: null },
      include: bookingListInclude,
      orderBy: { startsAt: 'desc' },
    });
  }

  /**
   * Истечение ожидания подтверждения: pending с истёкшим pendingExpiresAt → expired.
   */
  async expirePendingPastDeadline(now: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.booking.findMany({
        where: {
          status: 'pending',
          deletedAt: null,
          pendingExpiresAt: { lte: now },
        },
        select: { id: true },
      });
      const reason = BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT;
      for (const row of due) {
        await tx.booking.update({
          where: { id: row.id },
          data: {
            status: 'expired',
            pendingExpiresAt: null,
            cancelReason: reason,
          },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: row.id,
            fromStatus: 'pending',
            toStatus: 'expired',
            actorUserId: null,
            reason,
          },
        });
      }
      return due.length;
    });
  }
}
