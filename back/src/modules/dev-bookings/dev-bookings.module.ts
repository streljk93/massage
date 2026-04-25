import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { DirectoryModule } from '../directory/directory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { DevBookingStatusService } from './application/dev-booking-status.service';
import { DevFcmTestService } from './application/dev-fcm-test.service';
import { DevPersonalizationRecomputeService } from './application/dev-personalization-recompute.service';
import { DevTestRoutesGuard } from './guards/dev-test-routes.guard';
import { DevFcmTestController } from './presentation/dev-fcm-test.controller';
import { DevBookingsController } from './presentation/dev-bookings.controller';
import { DevPersonalizationController } from './presentation/dev-personalization.controller';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    PersonalizationModule,
    DirectoryModule,
  ],
  controllers: [
    DevBookingsController,
    DevFcmTestController,
    DevPersonalizationController,
  ],
  providers: [
    DevBookingStatusService,
    DevFcmTestService,
    DevPersonalizationRecomputeService,
    DevTestRoutesGuard,
  ],
})
export class DevBookingsModule {}
