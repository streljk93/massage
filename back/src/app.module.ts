import './bootstrap-env';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
import { ModerationModule } from './modules/moderation/moderation.module';
import { AdminMasterModule } from './modules/admin/admin-master.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SpecialistsModule } from './modules/specialists/specialists.module';
import { UsersModule } from './modules/users/users.module';
import { isModerationContentQueueEnabled } from './modules/moderation/queue/moderation-queue-enabled';

const bullRootImports = isModerationContentQueueEnabled()
  ? [
      BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const passwordRaw = config.get<string>('redis.password')?.trim();
          return {
            connection: {
              host: config.getOrThrow<string>('redis.host'),
              port: config.getOrThrow<number>('redis.port'),
              ...(passwordRaw ? { password: passwordRaw } : {}),
              maxRetriesPerRequest: null,
            },
          };
        },
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '../.env.local', '.env', '.env.local'],
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
    ...bullRootImports,
    ScheduleModule.forRoot(),
    PrismaModule,
    AddressModule,
    StorageModule,
    HealthModule,
    FilesModule,
    AuthModule,
    AdminMasterModule,
    NotificationsModule,
    UsersModule,
    ModerationModule,
    SpecialistsModule,
    OrganizationsModule,
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
