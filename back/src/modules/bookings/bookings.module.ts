import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsSchedulerService } from './application/bookings-scheduler.service';
import { BookingsService } from './application/bookings.service';
import { ClientBookingRemindersService } from './application/client-booking-reminders.service';
import { BookingStatusLocaleRepository } from './infrastructure/booking-status-locale.repository';
import { BookingsRepository } from './infrastructure/bookings.repository';
import { BookingsController } from './presentation/bookings.controller';
import { SpecialistBookingsController } from './presentation/specialist-bookings.controller';

@Module({
  imports: [AuthModule, ModerationModule, NotificationsModule],
  controllers: [BookingsController, SpecialistBookingsController],
  providers: [
    BookingsService,
    ClientBookingRemindersService,
    BookingsRepository,
    BookingStatusLocaleRepository,
    BookingsSchedulerService,
  ],
  exports: [BookingsRepository],
})
export class BookingsModule {}
