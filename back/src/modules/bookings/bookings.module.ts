import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsService } from './application/bookings.service';
import { BookingsRepository } from './infrastructure/bookings.repository';
import { BookingsController } from './presentation/bookings.controller';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
})
export class BookingsModule {}
