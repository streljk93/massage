import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addMinutes } from 'date-fns';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { isBookingSlotStartTimeReached } from '../../bookings/domain/booking-in-progress-start-policy';
import { isBookingStatusTransitionAllowed } from '../../bookings/domain/booking-status-transitions';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import type { SetTestBookingStatusBody } from '../dto/set-test-booking-status-body.schema';

const DEV_PENDING_GRACE_MINUTES = 15;

@Injectable()
export class DevBookingStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
  ) {}

  /**
   * Принудительная смена статуса по `bookingId` для отладки (без роли мастера).
   * Переходы те же, что в проде: {@link isBookingStatusTransitionAllowed}.
   */
  async setBookingStatusForDev(body: SetTestBookingStatusBody) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: body.bookingId,
        deletedAt: null,
      },
      select: {
        id: true,
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

    const fromStatus = booking.status;
    const toStatus = body.status;

    if (!isBookingStatusTransitionAllowed(fromStatus, toStatus)) {
      throw new BadRequestException({
        code: 'BOOKING_INVALID_STATUS_TRANSITION',
        message: `Transition not allowed: ${fromStatus} -> ${toStatus}`,
      });
    }

    const now = new Date();

    if (
      toStatus === 'in_progress' &&
      !isBookingSlotStartTimeReached(booking.startsAt, now)
    ) {
      throw new BadRequestException({
        code: 'BOOKING_TOO_EARLY_FOR_IN_PROGRESS',
        message: 'Cannot mark in progress before the scheduled start time',
      });
    }

    if (
      fromStatus === 'confirmed' &&
      (toStatus === 'no_show_by_client' || toStatus === 'no_show_by_master') &&
      !isBookingSlotStartTimeReached(booking.startsAt, now)
    ) {
      throw new BadRequestException({
        code: 'BOOKING_TOO_EARLY_FOR_NO_SHOW',
        message: 'Cannot mark no-show before the scheduled service start time',
      });
    }

    const historyReason =
      [body.reason, body.cancelReason].filter(Boolean).join(' | ') || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelLike =
        toStatus === 'canceled_by_master' ||
        toStatus === 'canceled_by_client' ||
        toStatus === 'reject_by_master' ||
        toStatus === 'reject_by_client' ||
        toStatus === 'expired';

      const row = await tx.booking.update({
        where: { id: body.bookingId },
        data: {
          status: toStatus,
          pendingExpiresAt:
            toStatus === 'pending'
              ? addMinutes(new Date(), DEV_PENDING_GRACE_MINUTES)
              : null,
          ...(cancelLike && body.cancelReason !== undefined
            ? { cancelReason: body.cancelReason }
            : {}),
          ...(cancelLike && body.cancellationComment !== undefined
            ? { cancellationComment: body.cancellationComment }
            : {}),
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: body.bookingId,
          fromStatus,
          toStatus,
          actorUserId: null,
          reason: historyReason,
        },
      });

      return row;
    });

    if (fromStatus !== toStatus) {
      // await: FCM + контекст брони — до ответа 200, иначе при void фоновая задача
      // (serverless/таймаут/рестарт) могла не успеть, в т.ч. для `pending` → `confirmed`.
      await this.push.notifyClientBookingStatusChange(
        body.bookingId,
        fromStatus,
        toStatus,
      );
    }

    return {
      id: updated.id,
      status: updated.status,
      previousStatus: fromStatus,
    };
  }
}
