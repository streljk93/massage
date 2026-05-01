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
    select: {
      listingName: true,
      imageUrl: true,
      user: { select: { name: true } },
    },
  },
  organization: {
    select: { name: true },
  },
  organizationReview: {
    where: { deletedAt: null },
    select: {
      id: true,
      rating: true,
      publishedComment: true,
      pendingCommentDraft: true,
    },
  },
  specialistReview: {
    where: { deletedAt: null },
    select: {
      id: true,
      rating: true,
      publishedComment: true,
      pendingCommentDraft: true,
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingListRow = Prisma.BookingGetPayload<{
  include: typeof bookingListInclude;
}>;

const ACTIVE_BOOKING_STATUSES: Array<'pending' | 'confirmed' | 'in_progress'> =
  ['pending', 'confirmed', 'in_progress'];

const salonCabinetBookingSelect = {
  id: true,
  status: true,
  startsAt: true,
  endsAt: true,
  pendingExpiresAt: true,
  categoryShortNameSnapshot: true,
  priceAmountSnapshot: true,
  currencySnapshot: true,
  cancelReason: true,
  cancellationComment: true,
  client: { select: { name: true } },
  specialist: {
    select: {
      id: true,
      listingName: true,
      imageUrl: true,
      user: { select: { name: true } },
    },
  },
  organization: { select: { id: true, name: true } },
} satisfies Prisma.BookingSelect;

export type SalonCabinetBookingRow = Prisma.BookingGetPayload<{
  select: typeof salonCabinetBookingSelect;
}>;

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
   * Активные брони мастера по конкретной организации (`pending`, `confirmed`, `in_progress`)
   * — превью того, что отменится при уходе с этого места приёма (без мутаций).
   */
  findActiveBookingsAtOrganizationForCabinetPreview(
    specialistId: string,
    organizationId: string,
  ): Promise<
    Array<{
      id: string;
      status: BookingStatus;
      startsAt: Date;
      endsAt: Date;
      pendingExpiresAt: Date | null;
      categoryShortNameSnapshot: string | null;
      durationMinutes: number;
      clientDisplayName: string | null;
    }>
  > {
    return this.prisma.booking
      .findMany({
        where: {
          specialistId,
          organizationId,
          deletedAt: null,
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          pendingExpiresAt: true,
          categoryShortNameSnapshot: true,
          durationMinutes: true,
          client: {
            select: { name: true },
          },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          status: r.status,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          pendingExpiresAt: r.pendingExpiresAt ?? null,
          categoryShortNameSnapshot: r.categoryShortNameSnapshot,
          durationMinutes: r.durationMinutes,
          clientDisplayName: r.client.name?.trim()
            ? r.client.name.trim()
            : null,
        })),
      );
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
   * Превью активных записей всего салона (все специалисты) перед удалением организации.
   */
  findAllActiveBookingsAtOrganizationForDeletePreview(
    organizationId: string,
  ): Promise<
    Array<{
      id: string;
      status: BookingStatus;
      startsAt: Date;
      endsAt: Date;
      pendingExpiresAt: Date | null;
      categoryShortNameSnapshot: string | null;
      durationMinutes: number;
      clientDisplayName: string | null;
      specialistDisplayName: string | null;
    }>
  > {
    return this.prisma.booking
      .findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          pendingExpiresAt: true,
          categoryShortNameSnapshot: true,
          durationMinutes: true,
          client: {
            select: { name: true },
          },
          specialist: {
            select: {
              listingName: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      })
      .then((rows) =>
        rows.map((r) => {
          const listing = (r.specialist.listingName ?? '').trim();
          const userName = (r.specialist.user.name ?? '').trim();
          const specialistDisplayName =
            listing.length > 0 ? listing : userName.length > 0 ? userName : null;
          return {
            id: r.id,
            status: r.status,
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            pendingExpiresAt: r.pendingExpiresAt ?? null,
            categoryShortNameSnapshot: r.categoryShortNameSnapshot,
            durationMinutes: r.durationMinutes,
            clientDisplayName: r.client.name?.trim()
              ? r.client.name.trim()
              : null,
            specialistDisplayName,
          };
        }),
      );
  }

  /**
   * Активные записи салона переводятся в `reject_by_master`/`canceled_by_master` (удаление организации).
   */
  async cancelAllActiveBookingsAtOrganization(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      actorUserId: string;
      cancelReason: string;
      cancellationComment?: string | null;
    },
  ): Promise<
    Array<{ id: string; fromStatus: BookingStatus; toStatus: BookingStatus }>
  > {
    const rows = await tx.booking.findMany({
      where: {
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
          `Invalid booking status transition for org delete cancel: ${row.status} -> ${toStatus}`,
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
   * Все активные записи по организации (доступ только для пользователей с проверкой в сервисе).
   */
  findManyForSalonCabinetManaged(
    organizationIds: string[],
    statuses?: BookingStatus[],
  ): Promise<SalonCabinetBookingRow[]> {
    if (organizationIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        organizationId: { in: organizationIds },
        ...(statuses !== undefined && statuses.length > 0
          ? { status: { in: statuses } }
          : {}),
      },
      select: salonCabinetBookingSelect,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });
  }

  /** Записи конкретного мастера в организации-текущем месте приёма (кабинет «мои записи»). */
  findManyForSalonCabinetActiveWorkplace(
    specialistId: string,
    organizationId: string,
    statuses?: BookingStatus[],
  ): Promise<SalonCabinetBookingRow[]> {
    return this.prisma.booking.findMany({
      where: {
        specialistId,
        organizationId,
        deletedAt: null,
        ...(statuses !== undefined && statuses.length > 0
          ? { status: { in: statuses } }
          : {}),
      },
      select: salonCabinetBookingSelect,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Брони клиентов: пора напомнить (порог по `User.bookingReminderLeadMinutes` уже прошёл, визит ещё впереди).
   * Только `confirmed` — пока запись в ожидании мастера, напоминание «скоро визит» не шлём.
   */
  async findDueClientReminderBookingIds(now: Date): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT b.id
      FROM "Booking" b
      INNER JOIN "User" u ON u.id = b."clientUserId"
      WHERE b."deletedAt" IS NULL
        AND b.status = 'confirmed'
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
