import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addMinutes, parseISO, subHours } from 'date-fns';
import type { BookingStatus, Prisma } from '@prisma/client';
import { normalizeDirectoryListingWorkdayBounds } from '../../../common/availability/directory-listing-workday';
import {
  BOOKING_START_TOLERANCE_MS,
  checkListingBookability,
} from '../../../common/availability/listing-slot-policy';
import type { ApiLocale } from '../../../common/i18n';
import {
  buildBookingStatusLabelMap,
  parseApiLocale,
  pickBookingStatusLabel,
  pickLocalizedServiceName,
} from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CancelBookingBody } from '../dto/cancel-booking-body.schema';
import type { CreateBookingBody } from '../dto/create-booking-body.schema';
import type { SubmitBookingVisitReviewsBody } from '../dto/submit-booking-visit-reviews-body.schema';
import { BookingStatusLocaleRepository } from '../infrastructure/booking-status-locale.repository';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import { BookingsRepository } from '../infrastructure/bookings.repository';
import { isBookingSlotStartTimeReached } from '../domain/booking-in-progress-start-policy';
import { isBookingStatusTransitionAllowed } from '../domain/booking-status-transitions';

/** Если у специалиста нет активной организации — дефолтное окно подтверждения (мин). */
const DEFAULT_BOOKING_CONFIRMATION_GRACE_MINUTES = 15;

function isVndCurrency(currency: string | null | undefined): boolean {
  return (currency ?? 'VND').toUpperCase() === 'VND';
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  private async resolveBookingsListLocale(
    clientUserId: string,
    localeFromQuery: ApiLocale | undefined,
  ): Promise<ApiLocale> {
    if (localeFromQuery !== undefined) {
      return localeFromQuery;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: clientUserId, deletedAt: null },
      select: { locale: true },
    });
    return parseApiLocale(user?.locale);
  }

  /**
   * Лимиты на создание брони: одновременные pending + скорость создания (скользящие окна).
   * Значения по умолчанию комфортны для обычного пользователя (несколько сравнений мастеров);
   * при необходимости — env `BOOKING_CLIENT_*` в {@link configuration}.
   */
  private async assertClientBookingCreationLimits(
    clientUserId: string,
  ): Promise<void> {
    const limits = this.config.getOrThrow<{
      maxPendingPerClient: number;
      maxCreatesPerHour: number;
      maxCreatesPerDay: number;
    }>('bookingCreationLimits');

    const [pendingCount, hourCount, dayCount] = await Promise.all([
      this.bookingsRepository.countPendingForClient(clientUserId),
      this.bookingsRepository.countClientBookingsCreatedSince(
        clientUserId,
        subHours(new Date(), 1),
      ),
      this.bookingsRepository.countClientBookingsCreatedSince(
        clientUserId,
        subHours(new Date(), 24),
      ),
    ]);

    if (pendingCount >= limits.maxPendingPerClient) {
      throw new HttpException(
        {
          code: 'BOOKING_CLIENT_PENDING_LIMIT',
          message:
            'Too many bookings awaiting confirmation. Cancel or wait for expiry before creating new ones.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (hourCount >= limits.maxCreatesPerHour) {
      throw new HttpException(
        {
          code: 'BOOKING_CLIENT_CREATE_RATE_HOUR',
          message: 'Booking creation limit reached. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (dayCount >= limits.maxCreatesPerDay) {
      throw new HttpException(
        {
          code: 'BOOKING_CLIENT_CREATE_RATE_DAY',
          message: 'Daily booking creation limit reached. Try again tomorrow.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async createBooking(
    clientUserId: string,
    body: CreateBookingBody,
    locale: ApiLocale,
  ) {
    await this.assertClientBookingCreationLimits(clientUserId);

    const startsAt = parseISO(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_STARTS_AT',
        message: 'startsAt must be a valid ISO datetime',
      });
    }
    const now = Date.now();
    if (startsAt.getTime() < now - BOOKING_START_TOLERANCE_MS) {
      throw new BadRequestException({
        code: 'STARTS_AT_IN_PAST',
        message: 'Booking start time must be in the future',
      });
    }

    const specialist = await this.prisma.specialist.findFirst({
      where: { id: body.specialistId, deletedAt: null },
      select: {
        id: true,
        activeOrganizationId: true,
        userId: true,
        autoConfirmBookings: true,
      },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_NOT_FOUND',
        message: 'Specialist not found',
      });
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: body.serviceId,
        specialistId: body.specialistId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        priceOptions: true,
        locales: true,
      },
    });
    if (!service) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found for this specialist',
      });
    }

    const priceOpt = service.priceOptions.find(
      (p) =>
        p.durationMinutes === body.durationMinutes && isVndCurrency(p.currency),
    );
    if (!priceOpt) {
      throw new BadRequestException({
        code: 'INVALID_DURATION_OR_PRICE',
        message: 'No VND price option for this duration',
      });
    }

    let organizationId = specialist.activeOrganizationId;
    if (!organizationId) {
      const employment =
        await this.prisma.specialistOrganizationEmployment.findFirst({
          where: {
            specialistId: body.specialistId,
            isActive: true,
          },
          orderBy: { startDate: 'desc' },
        });
      organizationId = employment?.organizationId ?? null;
    }

    let graceMinutes = DEFAULT_BOOKING_CONFIRMATION_GRACE_MINUTES;
    let listingWorkday = normalizeDirectoryListingWorkdayBounds(
      undefined,
      undefined,
    );
    if (organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: {
          listingWorkdayStartMinute: true,
          listingWorkdayEndMinute: true,
          bookingConfirmationGraceMinutes: true,
        },
      });
      if (org) {
        listingWorkday = normalizeDirectoryListingWorkdayBounds(
          org.listingWorkdayStartMinute,
          org.listingWorkdayEndMinute,
        );
        if (
          Number.isFinite(org.bookingConfirmationGraceMinutes) &&
          org.bookingConfirmationGraceMinutes > 0
        ) {
          graceMinutes = org.bookingConfirmationGraceMinutes;
        }
      }
    }

    const endsAt = addMinutes(startsAt, body.durationMinutes);

    const bookability = checkListingBookability(
      startsAt,
      endsAt,
      listingWorkday,
    );
    if (!bookability.ok) {
      throw new BadRequestException({
        code: bookability.code,
        message:
          bookability.code === 'NOT_GRID_ALIGNED'
            ? 'startsAt must align to a 30-minute grid in the listing timezone'
            : 'Booking must fit within the salon listing workday in the listing timezone',
      });
    }

    const overlap = await this.bookingsRepository.findActiveOverlap(
      body.specialistId,
      startsAt,
      endsAt,
    );
    if (overlap) {
      throw new BadRequestException({
        code: 'SLOT_NOT_AVAILABLE',
        message: 'This time overlaps an existing active booking',
      });
    }

    const serviceNameSnapshot = pickLocalizedServiceName(service, locale);

    const shouldAutoConfirm = specialist.autoConfirmBookings;
    const pendingExpiresAt = shouldAutoConfirm
      ? null
      : addMinutes(new Date(now), graceMinutes);

    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          clientUserId,
          specialistId: body.specialistId,
          organizationId,
          serviceId: service.id,
          serviceNameSnapshot,
          durationMinutes: body.durationMinutes,
          priceAmountSnapshot: priceOpt.priceAmount,
          currencySnapshot: priceOpt.currency ?? 'VND',
          startsAt,
          endsAt,
          status: shouldAutoConfirm ? 'confirmed' : 'pending',
          pendingExpiresAt,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: b.id,
          fromStatus: null,
          toStatus: 'pending',
          actorUserId: clientUserId,
        },
      });
      if (shouldAutoConfirm) {
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: b.id,
            fromStatus: 'pending',
            toStatus: 'confirmed',
            /** Автоподтверждение по настройке мастера. */
            actorUserId: specialist.userId,
          },
        });
      }
      return b;
    });

    void this.pushNotifications.notifySpecialistNewBooking(booking.id);
    /**
     * Уведомление о новой брони — только мастеру. Клиент получает пуш/письмо при смене статуса и т.д.
     * При автоподтверждении отдельный FCM «подтверждение» не шлём — см. {@link PushNotificationsService.notifyClientBookingStatusChange}.
     */

    return {
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      pendingExpiresAt: booking.pendingExpiresAt?.toISOString() ?? null,
    };
  }

  async listMine(
    clientUserId: string,
    localeFromQuery: ApiLocale | undefined,
    statuses?: BookingStatus[],
  ) {
    const locale = await this.resolveBookingsListLocale(
      clientUserId,
      localeFromQuery,
    );
    const [rows, localeRows] = await Promise.all([
      this.bookingsRepository.findManyForClient(clientUserId, statuses),
      this.bookingStatusLocaleRepository.findAll(),
    ]);
    const labelMap = buildBookingStatusLabelMap(localeRows);
    return {
      bookings: rows.map((b) => {
        const orgRev = b.organizationReview;
        const spRev = b.specialistReview;
        const visitReviewComplete = orgRev != null && spRev != null;
        const visitReviewExcerpt = visitReviewComplete
          ? spRev.comment?.trim() || orgRev.comment?.trim() || null
          : null;
        const visitReviewDisplayRating = visitReviewComplete
          ? Math.round(((orgRev.rating + spRev.rating) / 2) * 10) / 10
          : null;

        return {
          id: b.id,
          status: b.status,
          statusLabel: pickBookingStatusLabel(b.status, locale, labelMap),
          specialistId: b.specialistId,
          specialistName: b.specialist.user.name,
          organizationName: b.organization?.name ?? null,
          specialistImageUrl: b.specialist.imageUrl,
          serviceName: b.serviceNameSnapshot ?? '—',
          amount: b.priceAmountSnapshot,
          currency: b.currencySnapshot ?? 'VND',
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          pendingExpiresAt: b.pendingExpiresAt?.toISOString() ?? null,
          cancelReason: b.cancelReason,
          cancellationComment: b.cancellationComment,
          visitReviewComplete,
          visitReviewDisplayRating,
          visitReviewExcerpt,
        };
      }),
    };
  }

  /**
   * Оценка визита: два отзыва в одной транзакции — `OrganizationReview` и `SpecialistReview`
   * (с привязкой `bookingId`). Только `status === done`, только клиент-владелец брони, один раз.
   */
  async submitVisitReviews(
    clientUserId: string,
    bookingId: string,
    body: SubmitBookingVisitReviewsBody,
  ): Promise<{ ok: true }> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        clientUserId,
        deletedAt: null,
      },
      include: {
        organizationReview: {
          where: { deletedAt: null },
          select: { id: true },
        },
        specialistReview: {
          where: { deletedAt: null },
          select: { id: true },
        },
        specialist: {
          select: { id: true, activeOrganizationId: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    if (booking.status !== 'done') {
      throw new BadRequestException({
        code: 'BOOKING_NOT_REVIEWABLE',
        message: 'Only completed visits can be reviewed',
      });
    }
    if (
      booking.organizationReview != null ||
      booking.specialistReview != null
    ) {
      throw new ConflictException({
        code: 'BOOKING_REVIEW_EXISTS',
        message: 'This visit has already been reviewed',
      });
    }

    const organizationId =
      booking.organizationId ?? booking.specialist.activeOrganizationId;
    if (organizationId == null) {
      throw new BadRequestException({
        code: 'BOOKING_ORGANIZATION_UNKNOWN',
        message: 'Cannot determine organization for this booking',
      });
    }

    const orgComment =
      body.organizationComment != null && body.organizationComment !== ''
        ? body.organizationComment
        : null;
    const spComment =
      body.specialistComment != null && body.specialistComment !== ''
        ? body.specialistComment
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationReview.create({
        data: {
          organizationId,
          authorUserId: clientUserId,
          bookingId: booking.id,
          rating: body.organizationRating,
          comment: orgComment,
        },
      });
      await tx.specialistReview.create({
        data: {
          specialistId: booking.specialistId,
          authorUserId: clientUserId,
          bookingId: booking.id,
          rating: body.specialistRating,
          comment: spComment,
        },
      });
      await this.refreshOrganizationReviewAggregates(tx, organizationId);
      await this.refreshSpecialistReviewAggregates(tx, booking.specialistId);
    });

    return { ok: true };
  }

  private async refreshOrganizationReviewAggregates(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const agg = await tx.organizationReview.aggregate({
      where: { organizationId, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const avg = agg._avg.rating;
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        reviewsCount: count,
        ratingAverage: count === 0 ? 0 : Number(avg ?? 0),
      },
    });
  }

  private async refreshSpecialistReviewAggregates(
    tx: Prisma.TransactionClient,
    specialistId: string,
  ): Promise<void> {
    const agg = await tx.specialistReview.aggregate({
      where: { specialistId, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const avg = agg._avg.rating;
    await tx.specialist.update({
      where: { id: specialistId },
      data: {
        reviewsCount: count,
        ratingAverage: count === 0 ? 0 : Number(avg ?? 0),
      },
    });
  }

  /** Вызывается cron: авто-expired для просроченного pending. */
  async expirePendingPastDeadline(): Promise<{
    count: number;
    bookingIds: string[];
  }> {
    return this.bookingsRepository.expirePendingPastDeadline(new Date());
  }

  /** Вызывается cron: `in_progress` с истёкшим `endsAt` → `done`. */
  async completeInProgressPastEndsAt(): Promise<{
    count: number;
    bookingIds: string[];
  }> {
    return this.bookingsRepository.completeInProgressPastEndsAt(new Date());
  }

  /**
   * Ручное подтверждение записи мастером: `pending` → `confirmed` + FCM клиенту.
   */
  async confirmPendingBySpecialist(
    specialistUserId: string,
    bookingId: string,
  ): Promise<{
    id: string;
    status: 'confirmed';
    startsAt: string;
    endsAt: string;
    pendingExpiresAt: null;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId: specialistUserId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new ForbiddenException({
        code: 'NOT_A_SPECIALIST',
        message: 'Only specialist accounts can confirm bookings',
      });
    }
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        specialistId: specialist.id,
        deletedAt: null,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    if (!isBookingStatusTransitionAllowed(booking.status, 'confirmed')) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_PENDING',
        message: 'Only a pending booking can be confirmed by the specialist',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed', pendingExpiresAt: null },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: 'pending',
          toStatus: 'confirmed',
          actorUserId: specialistUserId,
          reason: null,
        },
      });
      return row;
    });

    void this.pushNotifications.notifyClientBookingStatusChange(
      bookingId,
      'pending',
      'confirmed',
    );

    return {
      id: updated.id,
      status: 'confirmed',
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
      pendingExpiresAt: null,
    };
  }

  /**
   * Начало приёма: `confirmed` → `in_progress` (не раньше `startsAt`, с допуском как при создании брони).
   */
  async startVisitBySpecialist(
    specialistUserId: string,
    bookingId: string,
  ): Promise<{
    id: string;
    status: 'in_progress';
    startsAt: string;
    endsAt: string;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId: specialistUserId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new ForbiddenException({
        code: 'NOT_A_SPECIALIST',
        message: 'Only specialist accounts can start visits',
      });
    }
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        specialistId: specialist.id,
        deletedAt: null,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    if (!isBookingStatusTransitionAllowed(booking.status, 'in_progress')) {
      throw new BadRequestException({
        code: 'BOOKING_CANNOT_START_VISIT',
        message: 'Only a confirmed booking can be started',
      });
    }
    const now = new Date();
    if (!isBookingSlotStartTimeReached(booking.startsAt, now)) {
      throw new BadRequestException({
        code: 'BOOKING_TOO_EARLY_FOR_IN_PROGRESS',
        message: 'Cannot start visit before the scheduled start time',
      });
    }

    const fromStatus = booking.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'in_progress' },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus,
          toStatus: 'in_progress',
          actorUserId: specialistUserId,
          reason: null,
        },
      });
      return row;
    });

    void this.pushNotifications.notifyClientBookingStatusChange(
      bookingId,
      fromStatus,
      'in_progress',
    );

    return {
      id: updated.id,
      status: 'in_progress',
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
    };
  }

  async cancelByClient(
    clientUserId: string,
    bookingId: string,
    body: CancelBookingBody,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        clientUserId,
        deletedAt: null,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    const fromStatus = booking.status;
    const isPending = booking.status === 'pending';
    const toStatus = isPending ? 'reject_by_client' : 'canceled_by_client';

    if (!isBookingStatusTransitionAllowed(fromStatus, toStatus)) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: 'Booking cannot be canceled in its current state',
      });
    }

    let cancelReasonDb: string | null = null;
    let cancellationCommentDb: string | null = null;
    let historyReason: string | null = null;

    if (isPending) {
      cancelReasonDb = null;
      cancellationCommentDb = null;
      historyReason = null;
    } else {
      if (body.cancelReason == null) {
        throw new BadRequestException({
          code: 'BOOKING_CANCEL_REASON_REQUIRED',
          message:
            'cancelReason is required when canceling a confirmed or in-progress booking',
        });
      }
      const commentTrimmed = body.cancellationComment?.trim() ?? '';
      if (body.cancelReason === 'client_other' && commentTrimmed.length < 1) {
        throw new BadRequestException({
          code: 'BOOKING_CANCEL_COMMENT_REQUIRED',
          message:
            'cancellationComment is required when cancelReason is client_other',
        });
      }
      cancelReasonDb = body.cancelReason;
      cancellationCommentDb = commentTrimmed.length > 0 ? commentTrimmed : null;
      historyReason = [body.cancelReason, cancellationCommentDb ?? '']
        .filter((s) => s.length > 0)
        .join(' | ');
      historyReason = historyReason.length > 0 ? historyReason : null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: toStatus,
          pendingExpiresAt: null,
          cancelReason: cancelReasonDb,
          cancellationComment: cancellationCommentDb,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus,
          toStatus,
          actorUserId: clientUserId,
          reason: historyReason,
        },
      });
      return row;
    });

    void this.pushNotifications.notifySpecialistBookingCancelledByClient(
      bookingId,
    );

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}
