import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingsSchedulerService {
  private readonly logger = new Logger(BookingsSchedulerService.name);

  constructor(private readonly bookingsService: BookingsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingBookings(): Promise<void> {
    try {
      const n = await this.bookingsService.expirePendingPastDeadline();
      if (n > 0) {
        this.logger.log(
          `Expired ${n} pending booking(s) (no confirmation in time)`,
        );
      }
    } catch (e) {
      this.logger.error(
        'expirePendingPastDeadline failed',
        e instanceof Error ? e.stack : e,
      );
    }
  }
}
