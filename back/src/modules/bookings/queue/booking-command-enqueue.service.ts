import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';

import type { ApiLocale } from '../../../common/i18n';
import type { CreateBookingBody } from '../dto/create-booking-body.schema';
import type { SpecialistRescheduleConfirmedBookingBody } from '../dto/specialist-reschedule-confirmed-booking-body.schema';
import {
  BOOKING_COMMAND_JOB_CLIENT_CREATE,
  BOOKING_COMMAND_JOB_SPECIALIST_RESCHEDULE,
  BOOKING_COMMAND_QUEUE,
} from './booking-command-queue.const';

@Injectable()
export class BookingCommandEnqueueService {
  private readonly log = new Logger(BookingCommandEnqueueService.name);

  constructor(
    @InjectQueue(BOOKING_COMMAND_QUEUE) private readonly queue: Queue,
  ) {}

  private jobIdCreate(clientUserId: string, idempotencyKey: string): string {
    const h = createHash('sha256')
      .update(`bc:${clientUserId}\n${idempotencyKey}`, 'utf8')
      .digest('hex')
      .slice(0, 48);
    return `bc-${h}`;
  }

  private jobIdReschedule(
    bookingId: string,
    startsAt: string,
    reason: string,
  ): string {
    const h = createHash('sha256')
      .update(`br:${bookingId}\n${startsAt}\n${reason}`, 'utf8')
      .digest('hex')
      .slice(0, 48);
    return `br-${h}`;
  }

  /**
   * @returns false если Redis/Bull недоступны — вызывающий должен отдать BOOKING_BUSY_RETRY.
   */
  async enqueueClientBookingCreate(args: {
    clientUserId: string;
    body: CreateBookingBody;
    locale: ApiLocale;
    idempotencyKey: string;
  }): Promise<boolean> {
    const jobId = this.jobIdCreate(args.clientUserId, args.idempotencyKey);
    try {
      await this.queue.add(
        BOOKING_COMMAND_JOB_CLIENT_CREATE,
        {
          clientUserId: args.clientUserId,
          body: args.body,
          locale: args.locale,
          idempotencyKey: args.idempotencyKey,
        },
        {
          jobId,
          attempts: 24,
          backoff: { type: 'exponential', delay: 1500 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      );
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.toLowerCase().includes('job id')
      ) {
        return true;
      }
      this.log.warn(
        `Не удалось поставить client_booking_create в ${BOOKING_COMMAND_QUEUE}: ${msg}`,
      );
      return false;
    }
  }

  async enqueueSpecialistReschedule(args: {
    actingUserId: string;
    bookingId: string;
    body: SpecialistRescheduleConfirmedBookingBody;
  }): Promise<boolean> {
    const reason = args.body.reasonCode?.trim() ?? '';
    const jobId = this.jobIdReschedule(
      args.bookingId,
      args.body.startsAt,
      reason,
    );
    try {
      await this.queue.add(
        BOOKING_COMMAND_JOB_SPECIALIST_RESCHEDULE,
        {
          actingUserId: args.actingUserId,
          bookingId: args.bookingId,
          body: args.body,
        },
        {
          jobId,
          attempts: 24,
          backoff: { type: 'exponential', delay: 1500 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      );
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.toLowerCase().includes('job id')
      ) {
        return true;
      }
      this.log.warn(
        `Не удалось поставить specialist_reschedule в ${BOOKING_COMMAND_QUEUE}: ${msg}`,
      );
      return false;
    }
  }
}
