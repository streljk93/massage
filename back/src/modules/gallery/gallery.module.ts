import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationAccessPolicyModule } from '../organizations/organization-access-policy.module';
import { GalleryService } from './application/gallery.service';
import { GalleryCabinetController } from './presentation/gallery-cabinet.controller';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationAccessPolicyModule],
  controllers: [GalleryCabinetController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
