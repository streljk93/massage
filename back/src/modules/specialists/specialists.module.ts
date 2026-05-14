import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationAccessPolicyModule } from '../organizations/organization-access-policy.module';
import { SpecialistCabinetProfileService } from './application/specialist-cabinet-profile.service';
import { SpecialistOnboardingService } from './application/specialist-onboarding.service';
import { DirectoryModule } from '../directory/directory.module';
import { HiringModule } from '../hiring/hiring.module';
import { SpecialistWorkplaceService } from './application/specialist-workplace.service';
import {
  SpecialistsCabinetController,
  SpecialistWorkplacesController,
} from './presentation/specialists-cabinet.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BookingsModule,
    CalendarModule,
    ModerationModule,
    NotificationsModule,
    OrganizationAccessPolicyModule,
    forwardRef(() => DirectoryModule),
    HiringModule,
  ],
  controllers: [SpecialistsCabinetController, SpecialistWorkplacesController],
  providers: [
    SpecialistCabinetProfileService,
    SpecialistOnboardingService,
    SpecialistWorkplaceService,
  ],
  exports: [SpecialistCabinetProfileService, SpecialistOnboardingService],
})
export class SpecialistsModule {}
