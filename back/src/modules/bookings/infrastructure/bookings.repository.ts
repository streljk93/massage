import { Injectable } from '@nestjs/common';
import { Prisma, type BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
  BOOKING_STATUS_HISTORY_REASON_AUTO_DONE_AT_SLOT_END,
} from '../domain/booking-cancel-reason';
import {
  assertBookingStatusTransition,
  isBookingStatusTransitionAllowed,
} from '../domain/booking-status-transitions';

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
  async expirePendingPastDeadline(now: Date): Promise<{
    count: number;
    bookingIds: string[];
  }> {
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
        assertBookingStatusTransition('pending', 'expired');
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
      return { count: due.length, bookingIds: due.map((d) => d.id) };
    });
  }

  /**
   * Автозавершение приёма: `in_progress` с `endsAt` ≤ now → `done` (cron).
   */
  async completeInProgressPastEndsAt(now: Date): Promise<{
    count: number;
    bookingIds: string[];
  }> {
    const historyReason = BOOKING_STATUS_HISTORY_REASON_AUTO_DONE_AT_SLOT_END;
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.booking.findMany({
        where: {
          status: 'in_progress',
          deletedAt: null,
          endsAt: { lte: now },
        },
        select: { id: true },
      });
      for (const row of due) {
        assertBookingStatusTransition('in_progress', 'done');
        await tx.booking.update({
          where: { id: row.id },
          data: { status: 'done' },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: row.id,
            fromStatus: 'in_progress',
            toStatus: 'done',
            actorUserId: null,
            reason: historyReason,
          },
        });
      }
      return { count: due.length, bookingIds: due.map((d) => d.id) };
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
  ): Promise<
    Array<{ id: string; fromStatus: BookingStatus; toStatus: BookingStatus }>
  > {
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
    const out: Array<{
      id: string;
      fromStatus: BookingStatus;
      toStatus: BookingStatus;
    }> = [];
    for (const row of rows) {
      const toStatus: BookingStatus =
        row.status === 'pending' ? 'reject_by_master' : 'canceled_by_master';
      if (!isBookingStatusTransitionAllowed(row.status, toStatus)) {
        throw new Error(
          `Invalid booking status transition for org mass cancel: ${row.status} -> ${toStatus}`,
        );
      }
      await tx.booking.update({
        where: { id: row.id },
        data: {
          status: toStatus,
          pendingExpiresAt: null,
          cancelReason: args.cancelReason,
          cancellationComment: args.cancellationComment ?? null,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: row.id,
          fromStatus: row.status,
          toStatus,
          actorUserId: args.actorUserId,
          reason: historyReason.length > 0 ? historyReason : null,
        },
      });
      out.push({ id: row.id, fromStatus: row.status, toStatus });
    }
    return out;
  }

  /**
   * Брони клиентов: пора напомнить (порог по `User.bookingReminderLeadMinutes` уже прошёл, визит ещё впереди).
   */
  async findDueClientReminderBookingIds(now: Date): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT b.id
      FROM "Booking" b
      INNER JOIN "User" u ON u.id = b."clientUserId"
      WHERE b."deletedAt" IS NULL
        AND b.status IN ('pending', 'confirmed')
        AND b."clientReminderSentAt" IS NULL
        AND b."startsAt" > ${now}
        AND u."bookingReminderEnabled" = true
        AND b."startsAt" - (u."bookingReminderLeadMinutes" * interval '1 minute') <= ${now}
    `);
    return rows.map((r) => r.id);
  }

  markClientReminderSent(bookingId: string): Promise<void> {
    return this.prisma.booking
      .update({
        where: { id: bookingId },
        data: { clientReminderSentAt: new Date() },
      })
      .then(() => undefined);
  }
}
