import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpecialistWorkplaceService } from './application/specialist-workplace.service';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule, BookingsModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, SpecialistWorkplaceService],
})
export class UsersModule {}
