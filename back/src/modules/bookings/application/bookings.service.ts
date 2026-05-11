import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addMinutes, parseISO, subHours } from 'date-fns';
import {
  OfferingPriceOptionStatus,
  OfferingPublicationStatus,
  PublicationModerationStatus,
  SpecialistOfferingStatus,
  BookingEventType,
  CalendarEventStatus,
  type BookingStatus,
  type Prisma,
} from '@prisma/client';
import { normalizeDirectoryListingWorkdayBounds } from '../../../common/availability/directory-listing-workday';
import { collectListingSlotInvalidationSurface } from '../../../common/availability/listing-slot-cache-invalidation';
import {
  BOOKING_START_TOLERANCE_MS,
  checkListingBookability,
} from '../../../common/availability/listing-slot-policy';
import type { ApiLocale } from '../../../common/i18n';
import {
  buildBookingStatusLabelMap,
  parseApiLocale,
  pickBookingStatusLabel,
  pickLocalizedServiceCategoryFields,
  type CategoryLocaleShape,
} from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TransactionalOutboxService } from '../../../infrastructure/transactional-outbox/transactional-outbox.service';
import {
  BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
  BOOKING_COMPLETED_EVENT_REASON_CODE_AUTO_DONE_AT_SLOT_END,
} from '../domain/booking-cancel-reason';
import { buildBookingSnapshotCreateData } from '../domain/booking-snapshot.builder';
import { BookingAppendService } from './booking-append.service';
import { ContentModerationService } from '../../moderation/application/content-moderation.service';
import type { CancelBookingBody } from '../dto/cancel-booking-body.schema';
import type { SpecialistCancelConfirmedBookingBody } from '../dto/specialist-cancel-confirmed-booking-body.schema';
import type { SpecialistRescheduleConfirmedBookingBody } from '../dto/specialist-reschedule-confirmed-booking-body.schema';
import type { CreateBookingBody } from '../dto/create-booking-body.schema';
import type { SubmitBookingVisitReviewsBody } from '../dto/submit-booking-visit-reviews-body.schema';
import { BookingStatusLocaleRepository } from '../infrastructure/booking-status-locale.repository';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import {
  BookingsRepository,
  type SalonCabinetBookingRow,
} from '../infrastructure/bookings.repository';
import { isBookingSlotStartTimeReached } from '../domain/booking-in-progress-start-policy';
import { isOrganizationOfferingBookableMatchingDirectoryVitrineRules } from '../../services/domain/service-catalog-visibility';
import {
  OfferingPricingResolver,
  isOfferingPricingResolverError,
} from '../domain/offering-pricing-resolver.service';
import {
  isExclusionConstraintViolation,
  isPostgresLockTimeoutError,
} from '../domain/booking-db-errors';
import { BookingTxLocks } from '../domain/booking-tx-locks';
import {
  BOOKING_EXCLUDE_MAX_RETRIES,
  BOOKING_SLOT_TX_ATTEMPT_CAP,
  bookingExcludeRetryJitterMs,
} from '../domain/booking-slot-exclude-retry.policy';
import { BookingCommandEnqueueService } from '../queue/booking-command-enqueue.service';
import { CalendarService } from '../../calendar/application/calendar.service';
import { CalendarAvailabilityService } from '../../calendar/application/calendar-availability.service';
import { CalendarRepository } from '../../calendar/infrastructure/calendar.repository';
import { OrganizationAccessPolicyService } from '../../organizations/application/organization-access-policy.service';
import {
  OrganizationBookingActions,
  OrganizationCapabilities,
  assertCanOrganization,
  canAccessAllBookings,
  type OrganizationBookingAction,
} from '../../organizations/domain/policy';
import { buildOrganizationScope } from '../../organizations/domain/organization-scope';

/** Если у специалиста нет активной организации — дефолтное окно подтверждения (мин). */
const DEFAULT_BOOKING_CONFIRMATION_GRACE_MINUTES = 15;

/** Автор в списке бронирований видит черновик отзыва пока он на модерации; опубликованный текст — иначе. */
function bookingReviewMergedExcerpt(
  pending: string | null | undefined,
  published: string | null | undefined,
): string | null {
  const p = pending?.trim() ?? '';
  const q = published?.trim() ?? '';
  const merged = p !== '' ? p : q !== '' ? q : null;
  return merged;
}

type VisitReviewSnapshotRow = {
  rating: number;
  publishedComment: string | null;
  pendingCommentDraft: string | null;
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingStatusLocaleRepository: BookingStatusLocaleRepository,
    private readonly pushNotifications: PushNotificationsService,
    private readonly contentModeration: ContentModerationService,
    private readonly outbox: TransactionalOutboxService,
    private readonly offeringPricingResolver: OfferingPricingResolver,
    private readonly bookingAppend: BookingAppendService,
    private readonly calendarService: CalendarService,
    private readonly calendarAvailability: CalendarAvailabilityService,
    private readonly calendarRepository: CalendarRepository,
    private readonly organizationAccess: OrganizationAccessPolicyService,
    @Optional()
    private readonly bookingCommandEnqueue?: BookingCommandEnqueueService,
  ) {}

  async #sleepMs(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

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
    idempotencyKeyFromHeader?: string | null,
    options?: { slotRetryMode?: 'http' | 'worker' },
  ) {
    const trimmed =
      typeof idempotencyKeyFromHeader === 'string'
        ? idempotencyKeyFromHeader.trim()
        : '';
    const idempotencyKey = trimmed.length > 0 ? trimmed : null;
    if (idempotencyKey != null && idempotencyKey.length > 200) {
      throw new BadRequestException({
        code: 'BOOKING_IDEMPOTENCY_KEY_TOO_LONG',
        message: 'Idempotency-Key must be at most 200 characters',
      });
    }

    if (idempotencyKey != null) {
      const existing =
        await this.prisma.clientBookingCreateIdempotency.findUnique({
          where: {
            clientUserId_idempotencyKey: { clientUserId, idempotencyKey },
          },
          include: { booking: true },
        });
      if (existing?.booking != null && existing.booking.deletedAt == null) {
        const b = existing.booking;
        return {
          id: b.id,
          status: b.status,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          pendingExpiresAt: b.pendingExpiresAt?.toISOString() ?? null,
        };
      }
    }

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

    return this.createBookingViaOrganizationOffering(
      clientUserId,
      body,
      locale,
      idempotencyKey,
      options?.slotRetryMode ?? 'http',
    );
  }

  /**
   * Создание брони якорем OrganizationOffering + OfferingPriceOption через SpecialistOffering.
   */
  private async createBookingViaOrganizationOffering(
    clientUserId: string,
    body: CreateBookingBody,
    locale: ApiLocale,
    idempotencyKey: string | null,
    slotRetryMode: 'http' | 'worker',
  ) {
    const specialist = await this.prisma.specialist.findFirst({
      where: { id: body.specialistId, deletedAt: null },
      select: {
        id: true,
        activeOrganizationId: true,
        userId: true,
        listingName: true,
        user: { select: { name: true } },
        autoConfirmBookings: true,
        listedInDirectory: true,
      },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_NOT_FOUND',
        message: 'Specialist not found',
      });
    }

    let organizationId = specialist.activeOrganizationId;
    if (!organizationId) {
      const employment =
        await this.prisma.specialistOrganizationEmployment.findFirst({
          where: { specialistId: body.specialistId, isActive: true },
          orderBy: { startDate: 'desc' },
        });
      organizationId = employment?.organizationId ?? null;
    }

    let listingOrg: {
      listingWorkdayStartMinute: number | null;
      listingWorkdayEndMinute: number | null;
      bookingConfirmationGraceMinutes: number | null;
    } | null = null;

    let organizationNameForSnapshot: string | null = null;
    let addressLineForSnapshot: string | null = null;
    let cityForSnapshot: string | null = null;
    let workplaceOrgMajorCategoryIds: string[] | null = null;

    if (organizationId) {
      const [org, majorRows] = await Promise.all([
        this.prisma.organization.findFirst({
          where: { id: organizationId, deletedAt: null },
          select: {
            listingWorkdayStartMinute: true,
            listingWorkdayEndMinute: true,
            bookingConfirmationGraceMinutes: true,
            name: true,
            address: { select: { addressLine: true, city: true } },
          },
        }),
        this.prisma.organizationMajorServiceCategory.findMany({
          where: { organizationId },
          select: { majorServiceCategoryId: true },
        }),
      ]);
      listingOrg = org;
      if (org != null) {
        organizationNameForSnapshot = org.name;
        addressLineForSnapshot = org.address?.addressLine ?? null;
        cityForSnapshot = org.address?.city ?? null;
      }
      workplaceOrgMajorCategoryIds = majorRows.map(
        (m) => m.majorServiceCategoryId,
      );
    }

    const orgOfferingId = body.organizationOfferingId;
    const optId = body.offeringPriceOptionId;

    const startsAt = parseISO(body.startsAt);

    const assignment = await this.prisma.specialistOffering.findFirst({
      where: {
        specialistId: body.specialistId,
        organizationOfferingId: orgOfferingId,
        deletedAt: null,
        status: SpecialistOfferingStatus.active,
      },
      include: {
        organizationOffering: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
                description: true,
                sortOrder: true,
                majorServiceCategoryId: true,
                locales: {
                  select: {
                    locale: true,
                    name: true,
                    shortName: true,
                    description: true,
                  },
                },
              },
            },
            organization: {
              select: {
                id: true,
                deletedAt: true,
              },
            },
          },
        },
        priceOverrides: {
          where: { offeringPriceOptionId: optId },
          select: { offeringPriceOptionId: true, customPrice: true },
        },
      },
    });

    const off = assignment?.organizationOffering;
    if (
      assignment == null ||
      off == null ||
      off.deletedAt != null ||
      off.publicationStatus !== OfferingPublicationStatus.published ||
      off.organization == null
    ) {
      throw new NotFoundException({
        code: 'BOOKING_OFFERING_NOT_FOUND',
        message: 'Offering is not available for booking with this specialist',
      });
    }

    if (
      off.organizationId !== organizationId ||
      off.organization.deletedAt != null
    ) {
      throw new NotFoundException({
        code: 'BOOKING_OFFERING_NOT_FOUND',
        message: 'Offering is not available for booking with this specialist',
      });
    }

    if (
      !isOrganizationOfferingBookableMatchingDirectoryVitrineRules({
        offeringOrganizationId: off.organizationId,
        categoryMajorServiceCategoryId: off.category.majorServiceCategoryId,
        specialistListedInDirectory: specialist.listedInDirectory,
        workplaceOrganizationId: organizationId,
        workplaceOrganizationMajorCategoryIds: workplaceOrgMajorCategoryIds,
      })
    ) {
      throw new NotFoundException({
        code: 'BOOKING_OFFERING_NOT_FOUND',
        message: 'Offering is not available for booking with this specialist',
      });
    }

    const priceOpt = await this.prisma.offeringPriceOption.findFirst({
      where: {
        id: optId,
        organizationOfferingId: orgOfferingId,
        deletedAt: null,
        status: OfferingPriceOptionStatus.active,
      },
    });
    if (!priceOpt) {
      throw new NotFoundException({
        code: 'BOOKING_PRICE_OPTION_NOT_FOUND',
        message: 'Price option not available for this offering',
      });
    }

    if (
      body.durationMinutes != null &&
      body.durationMinutes !== priceOpt.durationMinutes
    ) {
      throw new BadRequestException({
        code: 'BOOKING_DURATION_MISMATCH',
        message: 'durationMinutes does not match the selected price option',
      });
    }

    const overrideRow = assignment.priceOverrides[0];
    let resolved: {
      priceAmount: number;
      currency: string;
      durationMinutes: number;
    };
    try {
      resolved = this.offeringPricingResolver.resolve({
        priceOption: priceOpt,
        override:
          overrideRow != null ? { customPrice: overrideRow.customPrice } : null,
      });
    } catch (e: unknown) {
      if (isOfferingPricingResolverError(e)) {
        throw new BadRequestException({
          code: e.code,
          message: e.message,
        });
      }
      throw e;
    }

    let graceMinutes = DEFAULT_BOOKING_CONFIRMATION_GRACE_MINUTES;
    let listingWorkday = normalizeDirectoryListingWorkdayBounds(
      undefined,
      undefined,
    );
    if (listingOrg) {
      listingWorkday = normalizeDirectoryListingWorkdayBounds(
        listingOrg.listingWorkdayStartMinute,
        listingOrg.listingWorkdayEndMinute,
      );
      if (
        listingOrg.bookingConfirmationGraceMinutes != null &&
        Number.isFinite(listingOrg.bookingConfirmationGraceMinutes) &&
        listingOrg.bookingConfirmationGraceMinutes > 0
      ) {
        graceMinutes = listingOrg.bookingConfirmationGraceMinutes;
      }
    }

    const endsAt = addMinutes(startsAt, resolved.durationMinutes);
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

    const categoryPresentation = pickLocalizedServiceCategoryFields(
      off.category as CategoryLocaleShape,
      locale,
    );
    const categoryShortNameSnapshot = categoryPresentation.shortName;
    const titleSnapshot =
      off.title.trim().length > 0
        ? off.title.trim()
        : categoryPresentation.name;

    const now = Date.now();
    const shouldAutoConfirm = specialist.autoConfirmBookings;
    const pendingExpiresAt = shouldAutoConfirm
      ? null
      : addMinutes(new Date(now), graceMinutes);

    const lockCfg = this.config.getOrThrow<{
      specialistAdvisoryLockTimeoutMs: number;
    }>('bookingConcurrency');

    const runCreateTx = (): Promise<{
      id: string;
      status: BookingStatus;
      startsAt: string;
      endsAt: string;
      pendingExpiresAt: string | null;
      shouldNotifySpecialist: boolean;
    }> =>
      this.prisma.$transaction(
        async (tx) => {
          await BookingTxLocks.setLockTimeoutMsForThisTransaction(
            tx,
            lockCfg.specialistAdvisoryLockTimeoutMs,
          );

          if (idempotencyKey != null) {
            await BookingTxLocks.acquireClientCreateIdempotency(tx, {
              clientUserId,
              idempotencyKey,
            });
            const idemEarly =
              await tx.clientBookingCreateIdempotency.findUnique({
                where: {
                  clientUserId_idempotencyKey: {
                    clientUserId,
                    idempotencyKey,
                  },
                },
                include: { booking: true },
              });
            if (
              idemEarly?.booking != null &&
              idemEarly.booking.deletedAt == null
            ) {
              const b = idemEarly.booking;
              return {
                id: b.id,
                status: b.status,
                startsAt: b.startsAt.toISOString(),
                endsAt: b.endsAt.toISOString(),
                pendingExpiresAt: b.pendingExpiresAt?.toISOString() ?? null,
                shouldNotifySpecialist: false,
              };
            }
          }

          if (organizationId == null) {
            throw new BadRequestException({
              code: 'BOOKING_ORGANIZATION_REQUIRED',
              message: 'Organization context is required for calendar booking',
            });
          }
          const resource =
            await this.calendarService.ensureSpecialistResourceForOrganizationTx(
              tx,
              {
                organizationId,
                specialistId: body.specialistId,
              },
            );
          await this.calendarAvailability.assertSlotAvailableForResourcesTx(
            tx,
            {
              organizationId,
              resourceIds: [resource.id],
              startsAt,
              endsAt,
              requireWorkingAvailability: true,
            },
          );
          const calendarEvent =
            await this.calendarRepository.createBookingCalendarEventTx(tx, {
              organizationId,
              bookingId: null,
              startsAt,
              endsAt,
              status: CalendarEventStatus.pending,
              createdByUserId: clientUserId,
              resourceIds: [resource.id],
            });

          const b = await tx.booking.create({
            data: {
              calendarEventId: calendarEvent.id,
              clientUserId,
              specialistId: body.specialistId,
              organizationId,
              organizationOfferingId: orgOfferingId,
              offeringPriceOptionId: optId,
              categoryShortNameSnapshot,
              durationMinutes: resolved.durationMinutes,
              priceAmountSnapshot: resolved.priceAmount,
              currencySnapshot: resolved.currency ?? 'VND',
              startsAt,
              endsAt,
              pendingExpiresAt: null,
            },
          });
          await this.calendarRepository.updateCalendarEventBookingIdTx(tx, {
            eventId: calendarEvent.id,
            bookingId: b.id,
          });
          await tx.bookingSnapshot.create({
            data: buildBookingSnapshotCreateData({
              bookingId: b.id,
              organizationOfferingId: orgOfferingId,
              offeringPriceOptionId: optId,
              organizationOfferingTitleSnapshot: titleSnapshot,
              organizationNameSnapshot: organizationNameForSnapshot,
              specialistDisplayNameSnapshot:
                specialist.listingName?.trim() ??
                specialist.user.name?.trim() ??
                null,
              durationMinutesSnapshot: resolved.durationMinutes,
              priceAmountSnapshot: resolved.priceAmount,
              currencySnapshot: resolved.currency ?? 'VND',
              addressLineSnapshot: addressLineForSnapshot,
              citySnapshot: cityForSnapshot,
            }),
          });
          await this.outbox.enqueueBookingCreated(tx, b.id);
          await this.bookingAppend.appendBookingEvent(tx, {
            bookingId: b.id,
            type: BookingEventType.created,
            actorUserId: clientUserId,
            idempotencyKey,
            payload: {
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              ...(pendingExpiresAt == null
                ? { pendingExpiresAt: null }
                : { pendingExpiresAt: pendingExpiresAt.toISOString() }),
            },
          });
          if (shouldAutoConfirm) {
            await this.bookingAppend.appendBookingEvent(tx, {
              bookingId: b.id,
              type: BookingEventType.confirmed,
              actorUserId: specialist.userId,
              payload: {},
            });
          }
          if (idempotencyKey != null) {
            try {
              await tx.clientBookingCreateIdempotency.create({
                data: { clientUserId, idempotencyKey, bookingId: b.id },
              });
            } catch (e: unknown) {
              const err = e as { code?: string };
              if (err.code === 'P2002') {
                const row = await tx.clientBookingCreateIdempotency.findUnique({
                  where: {
                    clientUserId_idempotencyKey: {
                      clientUserId,
                      idempotencyKey,
                    },
                  },
                  include: { booking: true },
                });
                if (row?.booking != null && row.booking.deletedAt == null) {
                  const br = row.booking;
                  return {
                    id: br.id,
                    status: br.status,
                    startsAt: br.startsAt.toISOString(),
                    endsAt: br.endsAt.toISOString(),
                    pendingExpiresAt:
                      br.pendingExpiresAt?.toISOString() ?? null,
                    shouldNotifySpecialist: false,
                  };
                }
              }
              throw e;
            }
          }
          const fresh = await tx.booking.findFirstOrThrow({
            where: { id: b.id },
          });
          return {
            id: fresh.id,
            status: fresh.status,
            startsAt: fresh.startsAt.toISOString(),
            endsAt: fresh.endsAt.toISOString(),
            pendingExpiresAt: fresh.pendingExpiresAt?.toISOString() ?? null,
            shouldNotifySpecialist: true,
          };
        },
        { timeout: 60_000 },
      );

    for (let attempt = 0; attempt < BOOKING_SLOT_TX_ATTEMPT_CAP; attempt++) {
      try {
        const booking = await runCreateTx();
        void collectListingSlotInvalidationSurface({
          intervals: [{ startsAt, endsAt }],
        });
        if (booking.shouldNotifySpecialist) {
          void this.pushNotifications.notifySpecialistNewBooking(booking.id);
        }
        return {
          id: booking.id,
          status: booking.status,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          pendingExpiresAt: booking.pendingExpiresAt,
        };
      } catch (e: unknown) {
        if (isPostgresLockTimeoutError(e)) {
          if (
            slotRetryMode === 'http' &&
            this.bookingCommandEnqueue != null &&
            idempotencyKey != null
          ) {
            const enqueued =
              await this.bookingCommandEnqueue.enqueueClientBookingCreate({
                clientUserId,
                body,
                locale,
                idempotencyKey,
              });
            if (enqueued) {
              throw new HttpException(
                {
                  code: 'BOOKING_QUEUED',
                  message:
                    'Создание записи поставлено в очередь из‑за высокой нагрузки; повторите POST с тем же Idempotency-Key через несколько секунд.',
                },
                HttpStatus.ACCEPTED,
              );
            }
          }
          if (slotRetryMode === 'worker') {
            throw e;
          }
          throw new HttpException(
            {
              code: 'BOOKING_BUSY_RETRY',
              message:
                'Server is busy; retry the request with the same Idempotency-Key header',
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (isExclusionConstraintViolation(e)) {
          if (attempt < BOOKING_EXCLUDE_MAX_RETRIES) {
            await this.#sleepMs(bookingExcludeRetryJitterMs());
            continue;
          }
          throw new BadRequestException({
            code: 'SLOT_ALREADY_TAKEN',
            message: 'This time overlaps an existing active booking',
          });
        }
        throw e;
      }
    }

    throw new Error('booking_create_unexpected');
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
        const preview = this.buildVisitReviewPreview(
          b.organizationReview ?? null,
          b.specialistReview ?? null,
        );

        return {
          id: b.id,
          status: b.status,
          statusLabel: pickBookingStatusLabel(b.status, locale, labelMap),
          specialistId: b.specialistId,
          specialistName:
            b.specialist.listingName?.trim() || b.specialist.user.name || '—',
          organizationName: b.organization?.name ?? null,
          specialistImageUrl: b.specialist.imageUrl,
          categoryShortName: b.categoryShortNameSnapshot ?? '—',
          amount: b.priceAmountSnapshot,
          currency: b.currencySnapshot ?? 'VND',
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          pendingExpiresAt: b.pendingExpiresAt?.toISOString() ?? null,
          cancelReason: b.cancelReason,
          cancellationComment: b.cancellationComment,
          ...preview,
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

    const initialOrgPub =
      orgComment != null && orgComment.trim() !== ''
        ? PublicationModerationStatus.pending_review
        : PublicationModerationStatus.approved;
    const initialSpPub =
      spComment != null && spComment.trim() !== ''
        ? PublicationModerationStatus.pending_review
        : PublicationModerationStatus.approved;

    let orgReviewId!: string;
    let specialistReviewId!: string;

    await this.prisma.$transaction(async (tx) => {
      const orgRev = await tx.organizationReview.create({
        data: {
          organizationId,
          authorUserId: clientUserId,
          bookingId: booking.id,
          rating: body.organizationRating,
          publicationModerationStatus: initialOrgPub,
          publishedComment: null,
          pendingCommentDraft: orgComment,
        },
      });
      orgReviewId = orgRev.id;
      const spRev = await tx.specialistReview.create({
        data: {
          specialistId: booking.specialistId,
          authorUserId: clientUserId,
          bookingId: booking.id,
          rating: body.specialistRating,
          publicationModerationStatus: initialSpPub,
          publishedComment: null,
          pendingCommentDraft: spComment,
        },
      });
      specialistReviewId = spRev.id;
      await this.refreshOrganizationReviewAggregates(tx, organizationId);
      await this.refreshSpecialistReviewAggregates(tx, booking.specialistId);
    });

    await this.contentModeration.moderateVisitReviewPair({
      organizationReviewId: orgReviewId,
      specialistReviewId,
      organizationComment: orgComment,
      specialistComment: spComment,
    });

    await this.prisma.$transaction(async (tx) => {
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
      where: {
        organizationId,
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
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
      where: {
        specialistId,
        deletedAt: null,
        publicationModerationStatus: PublicationModerationStatus.approved,
      },
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
    const now = new Date();
    const ids =
      await this.bookingsRepository.findBookingIdsPendingExpiredDeadline(now);
    const bookingIds: string[] = [];
    for (const id of ids) {
      await this.bookingAppend.appendBookingEventNewTx({
        bookingId: id,
        type: BookingEventType.expired,
        actorUserId: null,
        payload: {
          reasonCode: BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
        },
      });
      bookingIds.push(id);
    }
    return { count: bookingIds.length, bookingIds };
  }

  /** Вызывается cron: `in_progress` с истёкшим `endsAt` → `done`. */
  async completeInProgressPastEndsAt(): Promise<{
    count: number;
    bookingIds: string[];
  }> {
    const now = new Date();
    const ids =
      await this.bookingsRepository.findBookingIdsInProgressPastSlotEnd(now);
    const bookingIds: string[] = [];
    for (const id of ids) {
      await this.bookingAppend.appendBookingEventNewTx({
        bookingId: id,
        type: BookingEventType.completed,
        actorUserId: null,
        payload: {
          reasonCode: BOOKING_COMPLETED_EVENT_REASON_CODE_AUTO_DONE_AT_SLOT_END,
          reasonText: BOOKING_COMPLETED_EVENT_REASON_CODE_AUTO_DONE_AT_SLOT_END,
        },
      });
      bookingIds.push(id);
    }
    return { count: bookingIds.length, bookingIds };
  }

  /**
   * Принимающий мастер брони или owner/admin салона (если в брони зафиксирована организация),
   * как в `GET /specialists/me/salon-bookings` (контекст «текущее место» / managed).
   */
  private async assertSalonSideMayActOnBooking(
    actingUserId: string,
    booking: {
      specialistId: string;
      organizationId: string | null;
    },
    action: OrganizationBookingAction = OrganizationBookingActions.MANAGE,
  ): Promise<void> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId: actingUserId, deletedAt: null },
      select: { id: true },
    });
    if (!specialist) {
      throw new ForbiddenException({
        code: 'NOT_A_SPECIALIST',
        message: 'Only specialist accounts can act on salon bookings',
      });
    }
    if (booking.organizationId == null) {
      if (booking.specialistId === specialist.id) {
        return;
      }
      throw new ForbiddenException({
        code: 'BOOKING_SALON_ACTION_FORBIDDEN',
        message:
          'You do not have permission to perform this action on this booking',
      });
    }
    const ctx = await this.organizationAccess.resolveContext(
      actingUserId,
      booking.organizationId,
    );
    assertCanOrganization(ctx, OrganizationCapabilities.BOOKINGS, {
      type: 'Booking',
      action,
      organizationId: booking.organizationId,
      specialistId: booking.specialistId,
    });
  }

  /** Границы витринного рабочего дня точки для проверки слота (как при создании брони). */
  private async resolveListingWorkdayForBookingOrganization(
    organizationId: string | null,
  ) {
    if (organizationId == null) {
      return normalizeDirectoryListingWorkdayBounds(undefined, undefined);
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        listingWorkdayStartMinute: true,
        listingWorkdayEndMinute: true,
      },
    });
    if (org == null) {
      return normalizeDirectoryListingWorkdayBounds(undefined, undefined);
    }
    return normalizeDirectoryListingWorkdayBounds(
      org.listingWorkdayStartMinute,
      org.listingWorkdayEndMinute,
    );
  }

  /**
   * Ручное подтверждение: `pending` → `confirmed` + FCM клиенту.
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
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        clientUserId: true,
        specialistId: true,
        organizationId: true,
        calendarEventId: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    await this.assertSalonSideMayActOnBooking(
      specialistUserId,
      {
        specialistId: booking.specialistId,
        organizationId: booking.organizationId,
      },
      OrganizationBookingActions.CONFIRM,
    );

    const fromStatus = booking.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.bookingAppend.appendBookingEvent(tx, {
        bookingId,
        type: BookingEventType.confirmed,
        actorUserId: specialistUserId,
        payload: {},
      });
      return tx.booking.findFirstOrThrow({ where: { id: bookingId } });
    });

    void this.pushNotifications.notifyClientBookingStatusChange(
      bookingId,
      fromStatus,
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
   * Отклонение ожидающей записи: `pending` → `reject_by_master` + FCM клиенту.
   */
  async rejectPendingBySpecialist(
    specialistUserId: string,
    bookingId: string,
  ): Promise<{
    id: string;
    status: 'reject_by_master';
  }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        clientUserId: true,
        specialistId: true,
        organizationId: true,
        calendarEventId: true,
        status: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    await this.assertSalonSideMayActOnBooking(
      specialistUserId,
      {
        specialistId: booking.specialistId,
        organizationId: booking.organizationId,
      },
      OrganizationBookingActions.CANCEL,
    );

    const fromStatus = booking.status;
    await this.prisma.$transaction(async (tx) => {
      await this.bookingAppend.appendBookingEvent(tx, {
        bookingId,
        type: BookingEventType.rejected,
        actorUserId: specialistUserId,
        payload: { rejectParty: 'specialist' },
      });
    });

    void this.pushNotifications.notifyClientBookingStatusChange(
      bookingId,
      fromStatus,
      'reject_by_master',
    );

    return { id: bookingId, status: 'reject_by_master' };
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
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        clientUserId: true,
        specialistId: true,
        organizationId: true,
        status: true,
        startsAt: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    await this.assertSalonSideMayActOnBooking(
      specialistUserId,
      {
        specialistId: booking.specialistId,
        organizationId: booking.organizationId,
      },
      OrganizationBookingActions.MANAGE,
    );
    const now = new Date();
    if (!isBookingSlotStartTimeReached(booking.startsAt, now)) {
      throw new BadRequestException({
        code: 'BOOKING_TOO_EARLY_FOR_IN_PROGRESS',
        message: 'Cannot start visit before the scheduled start time',
      });
    }

    const fromStatus = booking.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.bookingAppend.appendBookingEvent(tx, {
        bookingId,
        type: BookingEventType.started,
        actorUserId: specialistUserId,
        payload: {},
      });
      return tx.booking.findFirstOrThrow({ where: { id: bookingId } });
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

  /**
   * Отмена после подтверждения: `confirmed` → `canceled_by_master` + push клиенту.
   */
  async cancelConfirmedBySpecialist(
    actingUserId: string,
    bookingId: string,
    body: SpecialistCancelConfirmedBookingBody,
  ): Promise<{ id: string; status: BookingStatus }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        clientUserId: true,
        specialistId: true,
        organizationId: true,
        status: true,
        specialist: { select: { userId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    await this.assertSalonSideMayActOnBooking(
      actingUserId,
      {
        specialistId: booking.specialistId,
        organizationId: booking.organizationId,
      },
      OrganizationBookingActions.CANCEL,
    );

    const commentTrimmed = body.cancellationComment?.trim() ?? '';
    const cancelReasonDb = body.cancelReason;
    const cancellationCommentDb =
      commentTrimmed.length > 0 ? commentTrimmed : null;
    const historyPieces = [
      body.cancelReason,
      cancellationCommentDb ?? '',
    ].filter((s) => s.length > 0);
    const historyReason =
      historyPieces.length > 0 ? historyPieces.join(' | ') : null;

    const fromStatus = booking.status;
    const { projection } = await this.prisma.$transaction(async (tx) =>
      this.bookingAppend.appendBookingEvent(tx, {
        bookingId,
        type: BookingEventType.canceled,
        actorUserId: actingUserId,
        payload: {
          cancelParty: 'specialist',
          reasonCode: cancelReasonDb,
          cancellationComment: cancellationCommentDb,
          ...(historyReason !== null ? { reasonText: historyReason } : {}),
        },
      }),
    );

    void this.pushNotifications.notifyClientBookingStatusChange(
      bookingId,
      fromStatus,
      projection.status,
    );

    return { id: bookingId, status: projection.status };
  }

  /**
   * Перенос подтверждённого слота: `BookingEventType.rescheduled`, статус остаётся `confirmed`,
   * обновляются `startsAt` / `endsAt`; клиент получает отдельный push/email.
   */
  async rescheduleConfirmedBySpecialist(
    actingUserId: string,
    bookingId: string,
    body: SpecialistRescheduleConfirmedBookingBody,
    options?: { slotRetryMode?: 'http' | 'worker' },
  ): Promise<{
    id: string;
    status: 'confirmed';
    startsAt: string;
    endsAt: string;
  }> {
    const reschedulePolicy = this.config.getOrThrow<{
      forbidWithinMinutesBeforeOriginalStart: number;
    }>('bookingReschedulePolicy');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        specialistId: true,
        organizationId: true,
        calendarEventId: true,
        status: true,
        startsAt: true,
        endsAt: true,
        durationMinutes: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    await this.assertSalonSideMayActOnBooking(
      actingUserId,
      {
        specialistId: booking.specialistId,
        organizationId: booking.organizationId,
      },
      OrganizationBookingActions.RESCHEDULE,
    );
    if (booking.status !== 'confirmed') {
      throw new BadRequestException({
        code: 'BOOKING_NOT_CONFIRMED',
        message: 'Only a confirmed booking can be rescheduled',
      });
    }

    const leadMin = reschedulePolicy.forbidWithinMinutesBeforeOriginalStart;
    if (leadMin > 0) {
      const originalStartMs = booking.startsAt.getTime();
      const forbidAfterMs = originalStartMs - leadMin * 60_000;
      if (Date.now() > forbidAfterMs) {
        throw new BadRequestException({
          code: 'BOOKING_RESCHEDULE_DEADLINE_PASSED',
          message:
            'Rescheduling is no longer allowed this close to the original start time',
        });
      }
    }

    const newStartsAt = parseISO(body.startsAt);
    if (Number.isNaN(newStartsAt.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_STARTS_AT',
        message: 'startsAt must be a valid ISO datetime',
      });
    }
    const nowMs = Date.now();
    if (newStartsAt.getTime() < nowMs - BOOKING_START_TOLERANCE_MS) {
      throw new BadRequestException({
        code: 'STARTS_AT_IN_PAST',
        message: 'New booking start time must be in the future',
      });
    }

    const listingWorkday =
      await this.resolveListingWorkdayForBookingOrganization(
        booking.organizationId,
      );
    const newEndsAt = addMinutes(newStartsAt, booking.durationMinutes);
    const bookability = checkListingBookability(
      newStartsAt,
      newEndsAt,
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

    const lockCfg = this.config.getOrThrow<{
      specialistAdvisoryLockTimeoutMs: number;
    }>('bookingConcurrency');

    const runRescheduleTx = (): Promise<void> =>
      this.prisma.$transaction(
        async (tx) => {
          await BookingTxLocks.setLockTimeoutMsForThisTransaction(
            tx,
            lockCfg.specialistAdvisoryLockTimeoutMs,
          );
          if (booking.organizationId == null) {
            throw new BadRequestException({
              code: 'BOOKING_ORGANIZATION_REQUIRED',
              message: 'Organization context is required for calendar booking',
            });
          }
          const resource =
            await this.calendarService.ensureSpecialistResourceForOrganizationTx(
              tx,
              {
                organizationId: booking.organizationId,
                specialistId: booking.specialistId,
              },
            );
          await this.calendarAvailability.assertSlotAvailableForResourcesTx(
            tx,
            {
              organizationId: booking.organizationId,
              resourceIds: [resource.id],
              startsAt: newStartsAt,
              endsAt: newEndsAt,
              requireWorkingAvailability: true,
              excludeEventId: booking.calendarEventId,
            },
          );
          await this.bookingAppend.appendBookingEvent(tx, {
            bookingId,
            type: BookingEventType.rescheduled,
            actorUserId: actingUserId,
            payload: {
              previousStartsAt: booking.startsAt.toISOString(),
              previousEndsAt: booking.endsAt.toISOString(),
              nextStartsAt: newStartsAt.toISOString(),
              nextEndsAt: newEndsAt.toISOString(),
              ...(body.reasonCode != null && body.reasonCode.trim().length > 0
                ? { reasonCode: body.reasonCode.trim() }
                : {}),
            },
          });
        },
        { timeout: 60_000 },
      );

    const slotRetryMode = options?.slotRetryMode ?? 'http';

    for (let attempt = 0; attempt < BOOKING_SLOT_TX_ATTEMPT_CAP; attempt++) {
      try {
        await runRescheduleTx();
        break;
      } catch (e: unknown) {
        if (isPostgresLockTimeoutError(e)) {
          if (slotRetryMode === 'http' && this.bookingCommandEnqueue != null) {
            const enqueued =
              await this.bookingCommandEnqueue.enqueueSpecialistReschedule({
                actingUserId,
                bookingId,
                body,
              });
            if (enqueued) {
              throw new HttpException(
                {
                  code: 'BOOKING_QUEUED',
                  message:
                    'Перенос поставлен в очередь из‑за высокой нагрузки; повторите запрос через несколько секунд или дождитесь применения.',
                },
                HttpStatus.ACCEPTED,
              );
            }
          }
          if (slotRetryMode === 'worker') {
            throw e;
          }
          throw new HttpException(
            {
              code: 'BOOKING_BUSY_RETRY',
              message:
                'Server is busy; retry the same reschedule request shortly',
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (isExclusionConstraintViolation(e)) {
          if (attempt < BOOKING_EXCLUDE_MAX_RETRIES) {
            await this.#sleepMs(bookingExcludeRetryJitterMs());
            continue;
          }
          throw new BadRequestException({
            code: 'SLOT_ALREADY_TAKEN',
            message: 'This time overlaps an existing active booking',
          });
        }
        throw e;
      }
    }

    void collectListingSlotInvalidationSurface({
      intervals: [
        { startsAt: booking.startsAt, endsAt: booking.endsAt },
        { startsAt: newStartsAt, endsAt: newEndsAt },
      ],
    });
    void this.pushNotifications.notifyClientBookingRescheduled(bookingId);

    return {
      id: bookingId,
      status: 'confirmed',
      startsAt: newStartsAt.toISOString(),
      endsAt: newEndsAt.toISOString(),
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
      select: {
        status: true,
        specialistId: true,
        clientUserId: true,
        specialist: { select: { userId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    const isPending = booking.status === 'pending';
    const isConfirmed = booking.status === 'confirmed';

    if (!isPending && !isConfirmed) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: 'Booking cannot be canceled in its current state',
      });
    }

    let cancelReasonDb: string | null = null;
    let cancellationCommentDb: string | null = null;

    if (!isPending) {
      if (body.cancelReason == null) {
        throw new BadRequestException({
          code: 'BOOKING_CANCEL_REASON_REQUIRED',
          message:
            'cancelReason is required when canceling a confirmed booking',
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
    }

    const { projection } = await this.prisma.$transaction(async (tx) => {
      if (isPending) {
        return this.bookingAppend.appendBookingEvent(tx, {
          bookingId,
          type: BookingEventType.rejected,
          actorUserId: clientUserId,
          payload: { rejectParty: 'client' },
        });
      }
      return this.bookingAppend.appendBookingEvent(tx, {
        bookingId,
        type: BookingEventType.canceled,
        actorUserId: clientUserId,
        payload: {
          cancelParty: 'client',
          reasonCode: cancelReasonDb,
          cancellationComment: cancellationCommentDb,
        },
      });
    });

    void this.pushNotifications.notifySpecialistBookingCancelledByClient(
      bookingId,
    );

    return {
      id: bookingId,
      status: projection.status,
    };
  }

  /**
   * Бизнес-экран «Записи»:
   * - `managed` — все брони по всем организациям, где мастер owner/admin (legacy / расширенный обзор).
   * - `active_workplace` — контекст текущего места приёма: owner/admin видят все визиты этой организации;
   *   обычный specialist — только свои брони в этой организации.
   */
  async listSalonCabinetBusiness(
    userId: string,
    scope: 'managed' | 'active_workplace',
    localeFromQuery: ApiLocale | undefined,
  ): Promise<{
    bookings: Array<{
      id: string;
      status: BookingStatus;
      statusLabel: string;
      specialistId: string;
      specialistName: string;
      specialistImageUrl: string | null;
      organizationId: string | null;
      organizationName: string | null;
      clientDisplayName: string;
      categoryShortName: string;
      amount: number | null;
      currency: string;
      startsAt: string;
      endsAt: string;
      pendingExpiresAt: string | null;
      cancelReason: string | null;
      cancellationComment: string | null;
    }>;
  }> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, activeOrganizationId: true },
    });
    if (!specialist) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found',
      });
    }

    const locale = await this.resolveBookingsListLocale(
      userId,
      localeFromQuery,
    );

    const [localeRows, bookingRows] = await Promise.all([
      this.bookingStatusLocaleRepository.findAll(),
      scope === 'managed'
        ? this.loadManagedSalonCabinetBookings(userId, specialist.id)
        : this.loadActiveWorkplaceSalonCabinetBookings({
            ...specialist,
            userId,
          }),
    ]);

    const labelMap = buildBookingStatusLabelMap(localeRows);

    return {
      bookings: bookingRows.map((row) =>
        this.mapSalonCabinetBookingRow(row, locale, labelMap),
      ),
    };
  }

  private async loadManagedSalonCabinetBookings(
    userId: string,
    specialistId: string,
  ): Promise<SalonCabinetBookingRow[]> {
    const employments =
      await this.prisma.specialistOrganizationEmployment.findMany({
        where: {
          specialistId,
          isActive: true,
        },
        select: { organizationId: true },
      });
    const orgIds = [...new Set(employments.map((e) => e.organizationId))];
    const accessCache = this.organizationAccess.createContextCache();
    const scopes = (
      await Promise.all(
        orgIds.map(async (organizationId) => {
          const ctx = await accessCache.resolve(userId, organizationId);
          if (!canAccessAllBookings(ctx)) {
            return null;
          }
          return {
            organizationId,
            bookingScope: buildOrganizationScope(ctx).bookings,
          };
        }),
      )
    ).filter((scope): scope is NonNullable<typeof scope> => scope != null);
    return this.bookingsRepository.findManyForSalonCabinetScoped(scopes);
  }

  private async loadActiveWorkplaceSalonCabinetBookings(specialist: {
    userId: string;
    id: string;
    activeOrganizationId: string | null;
  }): Promise<SalonCabinetBookingRow[]> {
    if (specialist.activeOrganizationId == null) {
      return [];
    }
    const ctx = await this.organizationAccess.resolveContext(
      specialist.userId,
      specialist.activeOrganizationId,
    );
    return this.bookingsRepository.findManyForSalonCabinetScoped([
      {
        organizationId: specialist.activeOrganizationId,
        bookingScope: buildOrganizationScope(ctx).bookings,
      },
    ]);
  }

  private buildVisitReviewPreview(
    orgRev: VisitReviewSnapshotRow | null,
    spRev: VisitReviewSnapshotRow | null,
  ): {
    visitReviewComplete: boolean;
    visitReviewOrganizationRating: number | null;
    visitReviewSpecialistRating: number | null;
    visitReviewDisplayRating: number | null;
    visitReviewOrganizationExcerpt: string | null;
    visitReviewSpecialistExcerpt: string | null;
    visitReviewExcerpt: string | null;
  } {
    const visitReviewOrganizationExcerpt = orgRev
      ? bookingReviewMergedExcerpt(
          orgRev.pendingCommentDraft,
          orgRev.publishedComment,
        )
      : null;
    const visitReviewSpecialistExcerpt = spRev
      ? bookingReviewMergedExcerpt(
          spRev.pendingCommentDraft,
          spRev.publishedComment,
        )
      : null;
    const visitReviewComplete = orgRev != null && spRev != null;
    const visitReviewExcerpt = visitReviewComplete
      ? visitReviewSpecialistExcerpt || visitReviewOrganizationExcerpt || null
      : null;
    const visitReviewDisplayRating = visitReviewComplete
      ? Math.round(((orgRev.rating + spRev.rating) / 2) * 10) / 10
      : null;
    return {
      visitReviewComplete,
      visitReviewOrganizationRating: orgRev?.rating ?? null,
      visitReviewSpecialistRating: spRev?.rating ?? null,
      visitReviewDisplayRating,
      visitReviewOrganizationExcerpt,
      visitReviewSpecialistExcerpt,
      visitReviewExcerpt,
    };
  }

  private mapSalonCabinetBookingRow(
    row: SalonCabinetBookingRow,
    locale: ApiLocale,
    labelMap: Map<BookingStatus, { locale: string; label: string }[]>,
  ) {
    const specialistName =
      row.specialist.listingName?.trim() ||
      row.specialist.user.name?.trim() ||
      '—';
    const clientDisplayName = row.client.name?.trim()
      ? row.client.name.trim()
      : '—';
    const preview = this.buildVisitReviewPreview(
      row.organizationReview ?? null,
      row.specialistReview ?? null,
    );
    return {
      id: row.id,
      status: row.status,
      statusLabel: pickBookingStatusLabel(row.status, locale, labelMap),
      specialistId: row.specialist.id,
      specialistName,
      specialistImageUrl: row.specialist.imageUrl ?? null,
      organizationId: row.organization?.id ?? null,
      organizationName: row.organization?.name ?? null,
      clientDisplayName,
      categoryShortName:
        row.categoryShortNameSnapshot?.trim() &&
        row.categoryShortNameSnapshot.trim().length > 0
          ? row.categoryShortNameSnapshot.trim()
          : '—',
      amount: row.priceAmountSnapshot ?? null,
      currency: row.currencySnapshot ?? 'VND',
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      pendingExpiresAt: row.pendingExpiresAt?.toISOString() ?? null,
      cancelReason: row.cancelReason ?? null,
      cancellationComment: row.cancellationComment ?? null,
      ...preview,
    };
  }
}
