import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GalleryService } from './application/gallery.service';
import { GalleryCabinetController } from './presentation/gallery-cabinet.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GalleryCabinetController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
