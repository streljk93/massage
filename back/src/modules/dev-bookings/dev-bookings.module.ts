import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { DirectoryModule } from '../directory/directory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ModerationModule } from '../moderation/moderation.module';
import { DevBookingStatusService } from './application/dev-booking-status.service';
import { DevFcmTestService } from './application/dev-fcm-test.service';
import { DevPersonalizationRecomputeService } from './application/dev-personalization-recompute.service';
import { DevTestRoutesGuard } from './guards/dev-test-routes.guard';
import { DevFcmTestController } from './presentation/dev-fcm-test.controller';
import { DevBookingsController } from './presentation/dev-bookings.controller';
import { DevPersonalizationController } from './presentation/dev-personalization.controller';
import { DevWorkplaceJoinReviewController } from './presentation/dev-workplace-join-review.controller';
import { DevModerationController } from './presentation/dev-moderation.controller';
import { DevModerationQueueService } from './application/dev-moderation-queue.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    PersonalizationModule,
    DirectoryModule,
    OrganizationsModule,
    ModerationModule,
  ],
  controllers: [
    DevBookingsController,
    DevFcmTestController,
    DevPersonalizationController,
    DevWorkplaceJoinReviewController,
    DevModerationController,
  ],
  providers: [
    DevBookingStatusService,
    DevFcmTestService,
    DevPersonalizationRecomputeService,
    DevTestRoutesGuard,
    DevModerationQueueService,
  ],
})
export class DevBookingsModule {}
