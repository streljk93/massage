import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    HealthModule,
    FilesModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    DirectoryModule,
    AdvertisingModule,
    BookingsModule,
  ],
})
export class AppModule {}
