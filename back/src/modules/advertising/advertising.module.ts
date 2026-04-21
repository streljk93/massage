import { Module } from '@nestjs/common';
import { AdvertisingService } from './application/advertising.service';
import { AdvertisingRepository } from './infrastructure/advertising.repository';
import { AdvertisingController } from './presentation/advertising.controller';

@Module({
  controllers: [AdvertisingController],
  providers: [AdvertisingService, AdvertisingRepository],
})
export class AdvertisingModule {}
