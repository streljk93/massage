import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationAccessPolicyModule } from '../organizations/organization-access-policy.module';
import { CalendarAvailabilityService } from './application/calendar-availability.service';
import { CalendarService } from './application/calendar.service';
import { CalendarRepository } from './infrastructure/calendar.repository';
import { CalendarController } from './presentation/calendar.controller';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationAccessPolicyModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarAvailabilityService, CalendarRepository],
  exports: [CalendarService, CalendarAvailabilityService, CalendarRepository],
})
export class CalendarModule {}
