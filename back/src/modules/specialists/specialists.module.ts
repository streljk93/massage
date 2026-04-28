import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpecialistOnboardingService } from './application/specialist-onboarding.service';
import { SpecialistPersonalCatalogService } from './application/specialist-personal-catalog.service';
import { SpecialistWorkplaceService } from './application/specialist-workplace.service';
import { SpecialistsCabinetController } from './presentation/specialists-cabinet.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [SpecialistsCabinetController],
  providers: [
    SpecialistOnboardingService,
    SpecialistWorkplaceService,
    SpecialistPersonalCatalogService,
  ],
  exports: [SpecialistOnboardingService],
})
export class SpecialistsModule {}
