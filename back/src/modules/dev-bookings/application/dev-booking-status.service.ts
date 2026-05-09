import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BookingAppendService } from '../../bookings/application/booking-append.service';
import { devBookingStatusHopToAppend } from '../../bookings/domain/dev-booking-transition-to-append';
import { isBookingSlotStartTimeReached } from '../../bookings/domain/booking-in-progress-start-policy';
import { shortestBookingStatusTransitionPath } from '../../bookings/domain/booking-status-shortest-path';
import { isBookingStatusTransitionAllowed } from '../../bookings/domain/booking-status-transitions';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import type { SetTestBookingStatusBody } from '../dto/set-test-booking-status-body.schema';

@Injectable()
export class DevBookingStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingAppend: BookingAppendService,
    private readonly push: PushNotificationsService,
  ) {}

  /**
   * Принудительная смена статуса по `bookingId` для отладки (без роли мастера).
   * Пишется цепочка {@link BookingEvent} по кратчайшему допустимому пути матрицы.
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

    if (fromStatus === toStatus) {
      return {
        id: booking.id,
        status: booking.status,
        previousStatus: fromStatus,
      };
    }

    const path = shortestBookingStatusTransitionPath(fromStatus, toStatus);
    if (path === null || path.length < 2) {
      throw new BadRequestException({
        code: 'BOOKING_INVALID_STATUS_PATH',
        message: `No admissible event path ${fromStatus} → ${toStatus}`,
      });
    }

    const reasonGlue =
      [body.reason, body.cancelReason].filter(Boolean).join(' | ') || null;

    let finalGranularStatus = fromStatus;
    await this.prisma.$transaction(async (tx) => {
      let cur = fromStatus;
      for (let i = 1; i < path.length; i++) {
        const next = path[i]!;
        const hop = devBookingStatusHopToAppend(body.bookingId, {
          fromStatus: cur,
          toStatus: next,
          reasonFreeText: reasonGlue,
          cancelReason: body.cancelReason ?? null,
          cancellationComment: body.cancellationComment ?? null,
        });
        const { projection } = await this.bookingAppend.appendBookingEvent(
          tx,
          hop,
        );
        cur = projection.status;
      }
      finalGranularStatus = cur;
    });

    if (fromStatus !== finalGranularStatus) {
      // await: FCM + контекст брони — до ответа 200, иначе при void фоновая задача
      // (serverless/таймаут/рестарт) могла не успеть, в т.ч. для `pending` → `confirmed`.
      await this.push.notifyClientBookingStatusChange(
        body.bookingId,
        fromStatus,
        finalGranularStatus,
      );
    }

    return {
      id: booking.id,
      status: finalGranularStatus,
      previousStatus: fromStatus,
    };
  }
}
