import { Injectable, Logger } from '@nestjs/common';
import { PushNotificationsService } from '../../notifications/application/push-notifications.service';
import { BookingsRepository } from '../infrastructure/bookings.repository';

@Injectable()
export class ClientBookingRemindersService {
  private readonly logger = new Logger(ClientBookingRemindersService.name);

  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  /**
   * Cron: до визита осталось ≤ N минут (по настройке пользователя), напоминание ещё не слали.
   */
  async sendDueClientReminders(now: Date): Promise<number> {
    const ids =
      await this.bookingsRepository.findDueClientReminderBookingIds(now);
    let ok = 0;
    for (const id of ids) {
      try {
        await this.pushNotifications.notifyClientBookingReminder(id);
        await this.bookingsRepository.markClientReminderSent(id);
        ok += 1;
      } catch (e) {
        this.logger.warn(
          `Client reminder failed for booking ${id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return ok;
  }
}
