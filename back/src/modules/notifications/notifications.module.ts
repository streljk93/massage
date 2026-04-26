import { Module } from '@nestjs/common';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { PushNotificationsService } from './application/push-notifications.service';
import { BookingPushContextRepository } from './infrastructure/booking-push-context.repository';
import { FcmAdminService } from './infrastructure/fcm-admin.service';
import { UserFcmTokenRepository } from './infrastructure/user-fcm-token.repository';
import { PushTokensController } from './presentation/push-tokens.controller';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [PushTokensController],
  providers: [
    FcmAdminService,
    UserFcmTokenRepository,
    BookingPushContextRepository,
    PushNotificationsService,
  ],
  exports: [PushNotificationsService],
})
export class NotificationsModule {}
