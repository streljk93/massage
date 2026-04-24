import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  type PushFcmToUserResult,
  PushNotificationsService,
} from '../../notifications/application/push-notifications.service';
import type { DevTestFcmBody } from '../dto/dev-test-fcm-body.schema';

@Injectable()
export class DevFcmTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
  ) {}

  async sendTestFcmToUserByEmail(body: DevTestFcmBody): Promise<{
    ok: true;
    userId: string;
    email: string;
    tokensCount: number;
    /** Сколько секунд ждали перед FCM (0 — без ожидания). */
    delaySecondsApplied: number;
    fcm: PushFcmToUserResult;
  }> {
    if (!this.push.isFcmConfigured()) {
      throw new ServiceUnavailableException({
        code: 'FCM_NOT_CONFIGURED',
        message:
          'Firebase Admin is not configured (FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS).',
      });
    }
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: body.email.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'No user with this email',
      });
    }
    const tokensCount = await this.prisma.userFcmToken.count({
      where: { userId: user.id },
    });
    if (tokensCount < 1) {
      throw new BadRequestException({
        code: 'NO_FCM_TOKENS',
        message:
          'This user has no FCM token registered. Open the app logged in as this user, allow notifications, ensure NEXT_PUBLIC_FIREBASE_* + VAPID.',
      });
    }
    const delaySec = body.delaySeconds ?? 0;
    if (delaySec > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delaySec * 1000);
      });
    }
    const fcm = (await this.push.sendDevTestFcm(user.id, {
      title: body.title,
      body: body.text,
    })) ?? {
      attempted: 0,
      successCount: 0,
      errors: [
        { message: 'FCM not enabled (unexpected: checked before send)' },
      ],
    };
    return {
      ok: true,
      userId: user.id,
      email: user.email,
      tokensCount,
      delaySecondsApplied: delaySec,
      fcm,
    };
  }
}
