import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { DirectoryModule } from '../directory/directory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { FilesModule } from '../files/files.module';
import { ModerationModule } from '../moderation/moderation.module';
import { DevBookingStatusService } from './application/dev-booking-status.service';
import { DevDirectorySearchIndexService } from './application/dev-directory-search-index.service';
import { DevFcmTestService } from './application/dev-fcm-test.service';
import { DevPersonalizationRecomputeService } from './application/dev-personalization-recompute.service';
import { DevTestRoutesGuard } from './guards/dev-test-routes.guard';
import { DevFcmTestController } from './presentation/dev-fcm-test.controller';
import { DevBookingsController } from './presentation/dev-bookings.controller';
import { DevPersonalizationController } from './presentation/dev-personalization.controller';
import { DevWorkplaceJoinReviewController } from './presentation/dev-workplace-join-review.controller';
import { DevModerationController } from './presentation/dev-moderation.controller';
import { DevModerationQueueService } from './application/dev-moderation-queue.service';
import { DevSearchIndexController } from './presentation/dev-search-index.controller';

@Module({
  imports: [
    PrismaModule,
    BookingsModule,
    NotificationsModule,
    PersonalizationModule,
    DirectoryModule,
    OrganizationsModule,
    ModerationModule,
    FilesModule,
  ],
  controllers: [
    DevBookingsController,
    DevFcmTestController,
    DevPersonalizationController,
    DevWorkplaceJoinReviewController,
    DevModerationController,
    DevSearchIndexController,
  ],
  providers: [
    DevBookingStatusService,
    DevFcmTestService,
    DevPersonalizationRecomputeService,
    DevTestRoutesGuard,
    DevModerationQueueService,
    DevDirectorySearchIndexService,
  ],
})
export class DevBookingsModule {}
