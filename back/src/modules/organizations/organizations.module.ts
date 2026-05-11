import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AddressModule } from '../address/address.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { GalleryModule } from '../gallery/gallery.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DirectoryModule } from '../directory/directory.module';
import { SpecialistsModule } from '../specialists/specialists.module';
import { OrganizationCabinetService } from './application/organization-cabinet.service';
import { OrganizationsCabinetController } from './presentation/organizations-cabinet.controller';
import { OrganizationOfferingsCabinetController } from './presentation/organization-offerings-cabinet.controller';
import { OrganizationOfferingsCabinetService } from './application/organization-offerings-cabinet.service';
import { OrganizationAccessPolicyModule } from './organization-access-policy.module';

@Module({
  imports: [
    PrismaModule,
    AddressModule,
    AuthModule,
    GalleryModule,
    ModerationModule,
    forwardRef(() => SpecialistsModule),
    forwardRef(() => DirectoryModule),
    BookingsModule,
    NotificationsModule,
    OrganizationAccessPolicyModule,
  ],
  controllers: [
    OrganizationsCabinetController,
    OrganizationOfferingsCabinetController,
  ],
  providers: [OrganizationCabinetService, OrganizationOfferingsCabinetService],
  exports: [OrganizationCabinetService, OrganizationAccessPolicyModule],
})
export class OrganizationsModule {}
