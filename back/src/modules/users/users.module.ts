import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AddressModule } from '../address/address.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpecialistOnboardingService } from './application/specialist-onboarding.service';
import { SpecialistPersonalCatalogService } from './application/specialist-personal-catalog.service';
import { SpecialistWorkplaceService } from './application/specialist-workplace.service';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [PrismaModule, AddressModule, AuthModule, BookingsModule, NotificationsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    SpecialistWorkplaceService,
    SpecialistOnboardingService,
    SpecialistPersonalCatalogService,
  ],
})
export class UsersModule {}
