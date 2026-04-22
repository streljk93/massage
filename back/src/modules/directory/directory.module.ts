import { Module } from '@nestjs/common';
import { DirectoryService } from './application/directory.service';
import { DirectoryRepository } from './infrastructure/directory.repository';
import { DirectoryController } from './presentation/directory.controller';
import { OrganizationsController } from './presentation/organizations.controller';
import { SpecialistsController } from './presentation/specialists.controller';

@Module({
  controllers: [SpecialistsController, OrganizationsController, DirectoryController],
  providers: [DirectoryService, DirectoryRepository],
})
export class DirectoryModule {}
