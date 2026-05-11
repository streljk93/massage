import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionalOutboxModule } from '../../infrastructure/transactional-outbox/transactional-outbox.module';
import { CalendarModule } from '../calendar/calendar.module';
import { OrganizationAccessPolicyModule } from '../organizations/organization-access-policy.module';
import { BookingsSchedulerService } from './application/bookings-scheduler.service';
import { BookingsService } from './application/bookings.service';
import { ClientBookingRemindersService } from './application/client-booking-reminders.service';
import { BookingAppendService } from './application/booking-append.service';
import { BookingReconcileService } from './application/booking-reconcile.service';
import { BookingStatusLocaleRepository } from './infrastructure/booking-status-locale.repository';
import { BookingsRepository } from './infrastructure/bookings.repository';
import { OfferingPricingResolver } from './domain/offering-pricing-resolver.service';
import { BookingsController } from './presentation/bookings.controller';
import { SpecialistBookingsController } from './presentation/specialist-bookings.controller';
import { BOOKING_COMMAND_QUEUE } from './queue/booking-command-queue.const';
import { isBookingCommandQueueEnabled } from './queue/booking-command-queue-enabled';
import { BookingCommandEnqueueService } from './queue/booking-command-enqueue.service';
import { BookingCommandProcessor } from './queue/booking-command.processor';

const useBookingCommandQueue = isBookingCommandQueueEnabled();
const bookingCommandImports = useBookingCommandQueue
  ? [BullModule.registerQueue({ name: BOOKING_COMMAND_QUEUE })]
  : [];
const bookingCommandProviders = useBookingCommandQueue
  ? [BookingCommandEnqueueService, BookingCommandProcessor]
  : [];

@Module({
  imports: [
    AuthModule,
    CalendarModule,
    OrganizationAccessPolicyModule,
    ModerationModule,
    NotificationsModule,
    forwardRef(() => TransactionalOutboxModule),
    ...bookingCommandImports,
  ],
  controllers: [BookingsController, SpecialistBookingsController],
  providers: [
    BookingsService,
    BookingAppendService,
    BookingReconcileService,
    ClientBookingRemindersService,
    BookingsRepository,
    BookingStatusLocaleRepository,
    BookingsSchedulerService,
    OfferingPricingResolver,
    ...bookingCommandProviders,
  ],
  exports: [
    BookingsRepository,
    BookingStatusLocaleRepository,
    BookingsService,
    BookingAppendService,
    BookingReconcileService,
  ],
})
export class BookingsModule {}
