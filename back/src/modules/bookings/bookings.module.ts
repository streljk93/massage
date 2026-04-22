import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsSchedulerService } from './application/bookings-scheduler.service';
import { BookingsService } from './application/bookings.service';
import { BookingsRepository } from './infrastructure/bookings.repository';
import { BookingsController } from './presentation/bookings.controller';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository, BookingsSchedulerService],
})
export class BookingsModule {}
