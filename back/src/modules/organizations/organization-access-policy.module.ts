import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { OrganizationAccessPolicyService } from './application/organization-access-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [OrganizationAccessPolicyService],
  exports: [OrganizationAccessPolicyService],
})
export class OrganizationAccessPolicyModule {}

