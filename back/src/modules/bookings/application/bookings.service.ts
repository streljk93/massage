import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addMinutes, parseISO, subHours } from 'date-fns';
import type { BookingStatus } from '@prisma/client';
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
import { BookingStatusLocaleRepository } from '../infrastructure/booking-status-locale.repository';
import { BookingsRepository } from '../infrastructure/bookings.repository';

/** Если у специалиста нет активной организации — дефолтное окно подтверждения (мин). */
const DEFAULT_BOOKING_CONFIRMATION_GRACE_MINUTES = 15;

/** Клиент может отменить до визита / до начала приёма. */
const CLIENT_CANCELLABLE_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
];

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
      select: { id: true, activeOrganizationId: true },
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

    const endsAt = addMinutes(startsAt, body.durationMinutes);

    const bookability = checkListingBookability(startsAt, endsAt);
    if (!bookability.ok) {
      throw new BadRequestException({
        code: bookability.code,
        message:
          bookability.code === 'NOT_GRID_ALIGNED'
            ? 'startsAt must align to a 30-minute grid in the listing timezone'
            : 'Booking must fit within the default workday (08:00–22:00) in the listing timezone',
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
    if (organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { bookingConfirmationGraceMinutes: true },
      });
      if (
        org &&
        Number.isFinite(org.bookingConfirmationGraceMinutes) &&
        org.bookingConfirmationGraceMinutes > 0
      ) {
        graceMinutes = org.bookingConfirmationGraceMinutes;
      }
    }

    const serviceNameSnapshot = pickLocalizedServiceName(service, locale);

    const pendingExpiresAt = addMinutes(new Date(now), graceMinutes);

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
          status: 'pending',
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
      return b;
    });

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
      bookings: rows.map((b) => ({
        id: b.id,
        status: b.status,
        statusLabel: pickBookingStatusLabel(b.status, locale, labelMap),
        specialistId: b.specialistId,
        specialistName: b.specialist.user.name,
        specialistImageUrl: b.specialist.imageUrl,
        serviceName: b.serviceNameSnapshot ?? '—',
        amount: b.priceAmountSnapshot,
        currency: b.currencySnapshot ?? 'VND',
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        pendingExpiresAt: b.pendingExpiresAt?.toISOString() ?? null,
        cancelReason: b.cancelReason,
        cancellationComment: b.cancellationComment,
      })),
    };
  }

  /** Вызывается cron: авто-expired для просроченного pending. */
  async expirePendingPastDeadline(): Promise<number> {
    return this.bookingsRepository.expirePendingPastDeadline(new Date());
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
    if (!CLIENT_CANCELLABLE_STATUSES.some((s) => s === booking.status)) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: 'Booking cannot be canceled in its current state',
      });
    }

    const fromStatus = booking.status;
    const isPending = booking.status === 'pending';
    const toStatus = isPending ? 'reject_by_client' : 'canceled_by_client';

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

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}
