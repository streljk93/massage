import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DevBookingStatusService } from './application/dev-booking-status.service';
import { DevFcmTestService } from './application/dev-fcm-test.service';
import { DevTestRoutesGuard } from './guards/dev-test-routes.guard';
import { DevFcmTestController } from './presentation/dev-fcm-test.controller';
import { DevBookingsController } from './presentation/dev-bookings.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DevBookingsController, DevFcmTestController],
  providers: [DevBookingStatusService, DevFcmTestService, DevTestRoutesGuard],
})
export class DevBookingsModule {}
