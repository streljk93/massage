import { Injectable } from '@nestjs/common';
import { Prisma, type BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

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
  organizationReview: {
    where: { deletedAt: null },
    select: {
      rating: true,
      publishedComment: true,
      pendingCommentDraft: true,
    },
  },
  specialistReview: {
    where: { deletedAt: null },
    select: {
      rating: true,
      publishedComment: true,
      pendingCommentDraft: true,
    },
  },
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
    excludeBookingId?: string | null,
  ): Promise<{ id: string } | null> {
    return this.findActiveOverlapTx(
      this.prisma,
      specialistId,
      startsAt,
      endsAt,
      excludeBookingId,
    );
  }

  findActiveOverlapTx(
    db: Pick<Prisma.TransactionClient, 'booking'>,
    specialistId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBookingId?: string | null,
  ): Promise<{ id: string } | null> {
    return db.booking.findFirst({
      where: {
        specialistId,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        ...(excludeBookingId != null && excludeBookingId.length > 0 ?
          { id: { not: excludeBookingId } }
        : {}),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
  }

  /** `pending`, у которых истёк дедлайн подтверждения — для cron-события `expired`. */
  async findBookingIdsPendingExpiredDeadline(now: Date): Promise<string[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: 'pending',
        deletedAt: null,
        pendingExpiresAt: { lte: now },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Приём активен (`in_progress`), время слота прошло — для cron-события `completed` → `done`. */
  async findBookingIdsInProgressPastSlotEnd(now: Date): Promise<string[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: 'in_progress',
        deletedAt: null,
        endsAt: { lte: now },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Активные брони мастера по организации перед массовым событием (только идентификатор и статус).
   */
  findActiveMinimalForSpecialistOrganization(
    db: Pick<Prisma.TransactionClient, 'booking'>,
    args: {
      specialistId: string;
      organizationId: string;
    },
  ): Promise<Array<{ id: string; status: BookingStatus }>> {
    return db.booking.findMany({
      where: {
        specialistId: args.specialistId,
        organizationId: args.organizationId,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true, status: true },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Активные брони всей организации (все исполнители) — удаление салона и т.п.
   */
  findActiveMinimalForOrganizationAll(
    db: Pick<Prisma.TransactionClient, 'booking'>,
    organizationId: string,
  ): Promise<Array<{ id: string; status: BookingStatus }>> {
    return db.booking.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true, status: true },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
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
