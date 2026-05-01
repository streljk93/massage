import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminMasterBootstrapService } from './application/admin-master-bootstrap.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [AdminMasterBootstrapService],
})
export class AdminMasterModule {}
