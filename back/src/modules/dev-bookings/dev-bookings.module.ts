import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { DevBookingStatusService } from './application/dev-booking-status.service';
import { DevTestRoutesGuard } from './guards/dev-test-routes.guard';
import { DevBookingsController } from './presentation/dev-bookings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DevBookingsController],
  providers: [DevBookingStatusService, DevTestRoutesGuard],
})
export class DevBookingsModule {}
