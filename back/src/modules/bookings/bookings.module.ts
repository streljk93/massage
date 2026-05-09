import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionalOutboxModule } from '../../infrastructure/transactional-outbox/transactional-outbox.module';
import { BookingsSchedulerService } from './application/bookings-scheduler.service';
import { BookingsService } from './application/bookings.service';
import { ClientBookingRemindersService } from './application/client-booking-reminders.service';
import { BookingAppendService } from './application/booking-append.service';
import { BookingStatusLocaleRepository } from './infrastructure/booking-status-locale.repository';
import { BookingsRepository } from './infrastructure/bookings.repository';
import { OfferingPricingResolver } from './domain/offering-pricing-resolver.service';
import { BookingsController } from './presentation/bookings.controller';
import { SpecialistBookingsController } from './presentation/specialist-bookings.controller';

@Module({
  imports: [
    AuthModule,
    ModerationModule,
    NotificationsModule,
    forwardRef(() => TransactionalOutboxModule),
  ],
  controllers: [BookingsController, SpecialistBookingsController],
  providers: [
    BookingsService,
    BookingAppendService,
    ClientBookingRemindersService,
    BookingsRepository,
    BookingStatusLocaleRepository,
    BookingsSchedulerService,
    OfferingPricingResolver,
  ],
  exports: [
    BookingsRepository,
    BookingStatusLocaleRepository,
    BookingsService,
    BookingAppendService,
  ],
})
export class BookingsModule {}
