import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { AuthService } from './application/auth.service';
import { PendingRegistrationRepository } from './infrastructure/pending-registration.repository';
import { PasswordHasher } from './infrastructure/password-hasher';
import { UserRepository } from './infrastructure/user.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    UserRepository,
    PendingRegistrationRepository,
  ],
  exports: [AuthService, JwtModule, UserRepository],
})
export class AuthModule {}
