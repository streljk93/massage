import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AddressModule } from '../address/address.module';
import { AuthModule } from '../auth/auth.module';
import { GalleryModule } from '../gallery/gallery.module';
import { ModerationModule } from '../moderation/moderation.module';
import { SpecialistsModule } from '../specialists/specialists.module';
import { OrganizationCabinetService } from './application/organization-cabinet.service';
import { OrganizationsCabinetController } from './presentation/organizations-cabinet.controller';

@Module({
  imports: [
    PrismaModule,
    AddressModule,
    AuthModule,
    GalleryModule,
    ModerationModule,
    SpecialistsModule,
  ],
  controllers: [OrganizationsCabinetController],
  providers: [OrganizationCabinetService],
  exports: [OrganizationCabinetService],
})
export class OrganizationsModule {}
