import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationAccessPolicyModule } from '../organizations/organization-access-policy.module';
import { HiringService } from './application/hiring.service';
import { HiringRepository } from './infrastructure/hiring.repository';
import {
  HiringController,
  OrganizationHiringController,
  SpecialistHiringController,
} from './presentation/hiring.controller';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationAccessPolicyModule],
  controllers: [
    HiringController,
    OrganizationHiringController,
    SpecialistHiringController,
  ],
  providers: [HiringService, HiringRepository],
  exports: [HiringService],
})
export class HiringModule {}
