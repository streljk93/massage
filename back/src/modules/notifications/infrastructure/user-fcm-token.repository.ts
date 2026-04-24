import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class UserFcmTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Перед upsert: иначе P2003 на FK, если `sub` в JWT не в `User` (сброс БД, другой кластер). */
  async isActiveUserId(userId: string): Promise<boolean> {
    const n = await this.prisma.user.count({
      where: { id: userId, deletedAt: null },
    });
    return n > 0;
  }

  /**
   * `User.bookingReminderEnabled` — напоминания о визите заранее (cron, за N минут до `startsAt`).
   * Смена статуса брони (FCM) не зависит от этого флага.
   */
  async isBookingReminderEnabledForUserId(userId: string): Promise<boolean> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { bookingReminderEnabled: true },
    });
    return row?.bookingReminderEnabled === true;
  }

  async findTokensByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.userFcmToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  /**
   * FCM: один token на строку; upsert по `token`.
   * После успешной регистрации удаляем **остальные** токены этого user — иначе копятся
   * «зомби» (unregister, другой SW, другой профиль) и FCM честно шлёт success на мёртвую подписку.
   * Последний `POST` с клиента = единственный актуальный веб-получатель (мультидевайс: «кто вошёл последним»).
   */
  async upsertToken(
    userId: string,
    token: string,
    userAgent: string | undefined,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userFcmToken.upsert({
        where: { token },
        create: { userId, token, userAgent: userAgent ?? null },
        update: { userId, userAgent: userAgent ?? null },
      });
      await tx.userFcmToken.deleteMany({
        where: { userId, token: { not: token } },
      });
    });
  }

  async removeByUserAndToken(userId: string, token: string): Promise<void> {
    await this.prisma.userFcmToken.deleteMany({ where: { userId, token } });
  }

  async deleteByTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    await this.prisma.userFcmToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }
}
