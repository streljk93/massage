import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DevBookingsModule } from './modules/dev-bookings/dev-bookings.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { PersonalizationModule } from './modules/personalization/personalization.module';
import { FilesModule } from './modules/files/files.module';
import { AddressModule } from './modules/address/address.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('httpThrottle.ttlMs', 60_000),
          limit: config.get<number>('httpThrottle.limit', 400),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AddressModule,
    StorageModule,
    HealthModule,
    FilesModule,
    AuthModule,
    NotificationsModule,
    UsersModule,
    CatalogModule,
    DirectoryModule,
    PersonalizationModule,
    AdvertisingModule,
    BookingsModule,
    DevBookingsModule,
    FavoritesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
