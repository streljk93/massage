import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesService } from './application/files.service';
import { FilesController } from './presentation/files.controller';

@Module({
  imports: [AuthModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
