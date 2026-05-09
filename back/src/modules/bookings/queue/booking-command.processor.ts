import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { BookingsService } from '../application/bookings.service';
import type { CreateBookingBody } from '../dto/create-booking-body.schema';
import type { SpecialistRescheduleConfirmedBookingBody } from '../dto/specialist-reschedule-confirmed-booking-body.schema';
import type { ApiLocale } from '../../../common/i18n';
import {
  BOOKING_COMMAND_JOB_CLIENT_CREATE,
  BOOKING_COMMAND_JOB_SPECIALIST_RESCHEDULE,
  BOOKING_COMMAND_QUEUE,
} from './booking-command-queue.const';

@Injectable()
@Processor(BOOKING_COMMAND_QUEUE)
export class BookingCommandProcessor extends WorkerHost {
  constructor(private readonly bookings: BookingsService) {
    super();
  }

  async process(
    job: Job<
      | {
          clientUserId: string;
          body: CreateBookingBody;
          locale: ApiLocale;
          idempotencyKey: string;
        }
      | {
          actingUserId: string;
          bookingId: string;
          body: SpecialistRescheduleConfirmedBookingBody;
        }
    >,
  ): Promise<void> {
    if (job.name === BOOKING_COMMAND_JOB_CLIENT_CREATE) {
      const d = job.data as {
        clientUserId: string;
        body: CreateBookingBody;
        locale: ApiLocale;
        idempotencyKey: string;
      };
      await this.bookings.createBooking(
        d.clientUserId,
        d.body,
        d.locale,
        d.idempotencyKey,
        { slotRetryMode: 'worker' },
      );
      return;
    }
    if (job.name === BOOKING_COMMAND_JOB_SPECIALIST_RESCHEDULE) {
      const d = job.data as {
        actingUserId: string;
        bookingId: string;
        body: SpecialistRescheduleConfirmedBookingBody;
      };
      await this.bookings.rescheduleConfirmedBySpecialist(
        d.actingUserId,
        d.bookingId,
        d.body,
        { slotRetryMode: 'worker' },
      );
      return;
    }
    throw new Error(`Unknown booking command job name: ${job.name}`);
  }
}
