import { Injectable } from '@nestjs/common';
import type { BookingStatus, Prisma } from '@prisma/client';
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

  countPendingForClient(clientUserId: string): Promise<number> {
    return this.prisma.booking.count({
      where: {
        clientUserId,
        deletedAt: null,
        status: 'pending',
      },
    });
  }

  countClientBookingsCreatedSince(
    clientUserId: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        clientUserId,
        deletedAt: null,
        createdAt: { gte: since },
      },
    });
  }

  findManyForClient(
    clientUserId: string,
    statuses?: BookingStatus[],
  ): Promise<BookingListRow[]> {
    return this.prisma.booking.findMany({
      where: {
        clientUserId,
        deletedAt: null,
        ...(statuses !== undefined && statuses.length > 0
          ? { status: { in: statuses } }
          : {}),
      },
      include: bookingListInclude,
      /** Недавние изменения сверху (истечение pending, отмена и т.д.), не по дате приёма. */
      orderBy: [{ updatedAt: 'desc' }, { startsAt: 'desc' }],
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

  /**
   * Активные записи мастера по организации (место приёма) переводятся в `canceled_by_master`
   * (например при смене текущей организации у специалиста).
   */
  async cancelActiveBookingsAtOrganization(
    tx: Prisma.TransactionClient,
    args: {
      specialistId: string;
      organizationId: string;
      actorUserId: string | null;
      cancelReason: string;
      cancellationComment?: string | null;
    },
  ): Promise<number> {
    const rows = await tx.booking.findMany({
      where: {
        specialistId: args.specialistId,
        organizationId: args.organizationId,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true, status: true },
    });
    const historyReason = [args.cancelReason, args.cancellationComment ?? '']
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' | ');
    for (const row of rows) {
      await tx.booking.update({
        where: { id: row.id },
        data: {
          status: 'canceled_by_master',
          pendingExpiresAt: null,
          cancelReason: args.cancelReason,
          cancellationComment: args.cancellationComment ?? null,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: row.id,
          fromStatus: row.status,
          toStatus: 'canceled_by_master',
          actorUserId: args.actorUserId,
          reason: historyReason.length > 0 ? historyReason : null,
        },
      });
    }
    return rows.length;
  }
}
