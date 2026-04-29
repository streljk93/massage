import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from '../moderation/moderation.module';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule, ModerationModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
