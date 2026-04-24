import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import { ClientBookingRemindersService } from './client-booking-reminders.service';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingsSchedulerService {
  private readonly logger = new Logger(BookingsSchedulerService.name);

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly clientBookingReminders: ClientBookingRemindersService,
    private readonly push: PushNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingBookings(): Promise<void> {
    try {
      const { count, bookingIds } =
        await this.bookingsService.expirePendingPastDeadline();
      for (const id of bookingIds) {
        void this.push.notifyClientBookingStatusChange(
          id,
          'pending',
          'expired',
        );
      }
      if (count > 0) {
        this.logger.log(
          `Expired ${count} pending booking(s) (no confirmation in time)`,
        );
      }
    } catch (e) {
      this.logger.error(
        'expirePendingPastDeadline failed',
        e instanceof Error ? e.stack : e,
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendClientBookingReminders(): Promise<void> {
    try {
      const n = await this.clientBookingReminders.sendDueClientReminders(
        new Date(),
      );
      if (n > 0) {
        this.logger.log(`Sent ${n} client booking reminder(s)`);
      }
    } catch (e) {
      this.logger.error(
        'sendDueClientReminders failed',
        e instanceof Error ? e.stack : e,
      );
    }
  }
}
