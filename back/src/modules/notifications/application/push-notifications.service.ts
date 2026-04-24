import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type BookingStatus } from '@prisma/client';
import type { Message } from 'firebase-admin/messaging';
import { FcmAdminService } from '../infrastructure/fcm-admin.service';
import { UserFcmTokenRepository } from '../infrastructure/user-fcm-token.repository';
import { BookingPushContextRepository } from '../infrastructure/booking-push-context.repository';
import type {
  BookingPushContext,
  ClientBookingReminderContext,
} from '../infrastructure/booking-push-context.types';

/** Локальная копия контракта (как `BookingPushContextReader` в types) — в одном файле с вызовами, чтобы ESLint/IDE не ломал разрешение `import type` из соседнего модуля. */
type BookingPushContextRead = {
  findByBookingId(bookingId: string): Promise<BookingPushContext | null>;
  findForClientReminder(
    bookingId: string,
  ): Promise<ClientBookingReminderContext | null>;
};

function findClientReminderContext(
  r: BookingPushContextRead,
  bookingId: string,
): Promise<ClientBookingReminderContext | null> {
  return r.findForClientReminder(bookingId);
}

function findSpecialistPushContext(
  r: BookingPushContextRead,
  bookingId: string,
): Promise<BookingPushContext | null> {
  return r.findByBookingId(bookingId);
}

const INVALID_FCM_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

/** Сводка `sendEach` — для dev и диагностики. */
export type PushFcmToUserResult = {
  attempted: number;
  successCount: number;
  errors: { code?: string; message?: string }[];
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @Inject(FcmAdminService) private readonly fcm: FcmAdminService,
    @Inject(UserFcmTokenRepository)
    private readonly fcmTokens: UserFcmTokenRepository,
    @Inject(BookingPushContextRepository)
    private readonly bookingContext: BookingPushContextRead,
  ) {}

  async registerToken(
    userId: string,
    token: string,
    userAgent: string | undefined,
  ): Promise<void> {
    const userOk = await this.fcmTokens.isActiveUserId(userId);
    if (!userOk) {
      this.throwUserNotFoundForFcm();
    }
    try {
      await this.fcmTokens.upsertToken(userId, token, userAgent);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        this.logger.debug(
          `UserFcmToken upsert: FK (граница гонки или устаревший JWT) userId=…${userId.slice(-8)}`,
        );
        this.throwUserNotFoundForFcm();
      }
      throw e;
    }
  }

  private throwUserNotFoundForFcm(): never {
    throw new NotFoundException({
      code: 'USER_NOT_FOUND',
      message:
        'User from access token is missing in the database. Sign out and sign in again so the session matches this API.',
    });
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.fcmTokens.removeByUserAndToken(userId, token);
  }

  /**
   * Клиент: смена статуса брони (подтверждение, отмена мастером, истечение ожидания и т.д.).
   * Не уведомляем при `canceled_by_client` / `reject_by_client` (действие самого клиента).
   * Не зависит от `bookingReminderEnabled` (он только для {@link notifyClientBookingReminder}).
   */
  async notifyClientBookingStatusChange(
    bookingId: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
  ): Promise<void> {
    try {
      if (fromStatus === toStatus) {
        return;
      }
      if (
        toStatus === 'canceled_by_client' ||
        toStatus === 'reject_by_client'
      ) {
        return;
      }
      if (!this.fcm.isEnabled) {
        return;
      }
      const ctx = await findClientReminderContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const loc = this.normalizeWebLocale(ctx.clientLocale);
      const timeLabel = this.formatLocalAppointmentTime(ctx.startsAt, loc);
      const { title, body } = this.clientBookingStatusCopy(loc, toStatus, {
        service: ctx.serviceName,
        specialist: ctx.specialistName,
        timeLabel,
      });
      const webLink = `/${loc}/bookings`;
      await this.sendToUser(
        ctx.clientUserId,
        { title, body },
        {
          bookingId: String(bookingId),
          type: 'booking_status',
          toStatus: String(toStatus),
          timeLabel,
          serviceName: ctx.serviceName,
          specialistName: ctx.specialistName,
        },
        { webLink },
      );
    } catch (e) {
      this.logger.warn(`notifyClientBookingStatusChange: ${e}`);
    }
  }

  /**
   * Новая бронь — уведомление мастеру. Не зависит от настроек напоминаний.
   */
  async notifySpecialistNewBooking(bookingId: string): Promise<void> {
    try {
      if (!this.fcm.isEnabled) {
        return;
      }
      const ctx = await findSpecialistPushContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const service = ctx.serviceNameSnapshot?.trim() || 'Service';
      await this.sendToUser(
        ctx.specialistUserId,
        { title: 'New booking', body: `${ctx.clientName}: ${service}` },
        { bookingId, type: 'booking_new' },
      );
    } catch (e) {
      this.logger.warn(`notifySpecialistNewBooking: ${e}`);
    }
  }

  /**
   * Напоминание клиенту о визите (cron за N минут до `startsAt`).
   * Только при `User.bookingReminderEnabled` + `bookingReminderLeadMinutes` (и отбор в SQL).
   */
  async notifyClientBookingReminder(bookingId: string): Promise<void> {
    try {
      if (!this.fcm.isEnabled) {
        return;
      }
      const ctx = await findClientReminderContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      if (
        !(await this.fcmTokens.isBookingReminderEnabledForUserId(
          ctx.clientUserId,
        ))
      ) {
        return;
      }
      const loc = this.normalizeWebLocale(ctx.clientLocale);
      const timeLabel = this.formatLocalAppointmentTime(ctx.startsAt, loc);
      const { title, body } = this.clientReminderCopy(loc, {
        service: ctx.serviceName,
        specialist: ctx.specialistName,
        timeLabel,
      });
      const webLink = `/${loc}/bookings`;
      await this.sendToUser(
        ctx.clientUserId,
        { title, body },
        {
          bookingId: String(bookingId),
          type: 'booking_client_reminder',
          timeLabel,
          serviceName: ctx.serviceName,
          specialistName: ctx.specialistName,
        },
        { webLink },
      );
    } catch (e) {
      this.logger.warn(`notifyClientBookingReminder: ${e}`);
    }
  }

  private normalizeWebLocale(raw: string | null): 'en' | 'ru' | 'vi' {
    const c = (raw ?? 'en').trim().toLowerCase();
    if (c === 'ru' || c === 'vi' || c === 'en') {
      return c;
    }
    if (c.startsWith('ru')) {
      return 'ru';
    }
    if (c.startsWith('vi')) {
      return 'vi';
    }
    return 'en';
  }

  private formatLocalAppointmentTime(
    startsAt: Date,
    loc: 'en' | 'ru' | 'vi',
  ): string {
    return new Intl.DateTimeFormat(
      loc === 'en' ? 'en' : loc === 'ru' ? 'ru' : 'vi-VN',
      { dateStyle: 'short', timeStyle: 'short' },
    ).format(startsAt);
  }

  private clientBookingStatusCopy(
    loc: 'en' | 'ru' | 'vi',
    toStatus: BookingStatus,
    args: { service: string; specialist: string; timeLabel: string },
  ): { title: string; body: string } {
    const line = `${args.timeLabel} · ${args.service} · ${args.specialist}`;
    const M: Record<
      BookingStatus,
      Record<'en' | 'ru' | 'vi', { title: string; bodyPrefix: string }>
    > = {
      pending: {
        en: { title: 'Booking update', bodyPrefix: 'Pending' },
        ru: { title: 'Запись', bodyPrefix: 'В ожидании' },
        vi: { title: 'Cập nhật lịch', bodyPrefix: 'Chờ xác nhận' },
      },
      confirmed: {
        en: { title: 'Booking confirmed', bodyPrefix: 'Confirmed' },
        ru: { title: 'Запись подтверждена', bodyPrefix: 'Подтверждено' },
        vi: { title: 'Đã xác nhận lịch', bodyPrefix: 'Đã xác nhận' },
      },
      expired: {
        en: { title: 'Booking expired', bodyPrefix: 'Not confirmed in time' },
        ru: {
          title: 'Запись не подтверждена',
          bodyPrefix: 'Время ожидания вышло',
        },
        vi: { title: 'Lịch hết hạn', bodyPrefix: 'Hết hạn xác nhận' },
      },
      reject_by_master: {
        en: { title: 'Booking declined', bodyPrefix: 'Declined' },
        ru: { title: 'Запись отклонена', bodyPrefix: 'Отклонено' },
        vi: { title: 'Lịch bị từ chối', bodyPrefix: 'Đã từ chối' },
      },
      reject_by_client: {
        en: { title: 'Booking update', bodyPrefix: '' },
        ru: { title: 'Запись', bodyPrefix: '' },
        vi: { title: 'Cập nhật', bodyPrefix: '' },
      },
      canceled_by_master: {
        en: {
          title: 'Booking cancelled',
          bodyPrefix: 'Cancelled by specialist',
        },
        ru: { title: 'Запись отменена', bodyPrefix: 'Отмена специалистом' },
        vi: { title: 'Đã hủy lịch', bodyPrefix: 'Chuyên gia đã hủy' },
      },
      canceled_by_client: {
        en: { title: 'Booking update', bodyPrefix: '' },
        ru: { title: 'Запись', bodyPrefix: '' },
        vi: { title: 'Cập nhật', bodyPrefix: '' },
      },
      no_show_by_client: {
        en: { title: 'No-show', bodyPrefix: 'You did not attend' },
        ru: { title: 'Неявка', bodyPrefix: 'Вы не пришли' },
        vi: { title: 'Vắng mặt', bodyPrefix: 'Bạn đã không đến' },
      },
      no_show_by_master: {
        en: { title: 'No-show', bodyPrefix: 'Specialist was unavailable' },
        ru: { title: 'Неявка', bodyPrefix: 'Специалист не принял' },
        vi: { title: 'Vắng mặt', bodyPrefix: 'Chuyên gia không sẵn sàng' },
      },
      in_progress: {
        en: { title: 'Visit started', bodyPrefix: 'In progress' },
        ru: { title: 'Визит', bodyPrefix: 'Идёт приём' },
        vi: { title: 'Đang diễn ra', bodyPrefix: 'Đang thực hiện' },
      },
      done: {
        en: { title: 'Visit completed', bodyPrefix: 'Done' },
        ru: { title: 'Визит завершён', bodyPrefix: 'Завершено' },
        vi: { title: 'Đã hoàn thành', bodyPrefix: 'Xong' },
      },
    };
    const row = M[toStatus][loc];
    return {
      title: row.title,
      body: `${row.bodyPrefix ? `${row.bodyPrefix} — ` : ''}${line}`,
    };
  }

  private clientReminderCopy(
    loc: 'en' | 'ru' | 'vi',
    args: { service: string; specialist: string; timeLabel: string },
  ): { title: string; body: string } {
    if (loc === 'ru') {
      return {
        title: 'Скоро визит',
        body: `${args.timeLabel} · ${args.service} · ${args.specialist}`,
      };
    }
    if (loc === 'vi') {
      return {
        title: 'Sắp đến giờ hẹn',
        body: `${args.timeLabel} · ${args.service} · ${args.specialist}`,
      };
    }
    return {
      title: 'Upcoming visit',
      body: `${args.timeLabel} · ${args.service} · ${args.specialist}`,
    };
  }

  async notifySpecialistBookingCancelledByClient(
    bookingId: string,
  ): Promise<void> {
    try {
      if (!this.fcm.isEnabled) {
        return;
      }
      const ctx = await findSpecialistPushContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const service = ctx.serviceNameSnapshot?.trim() || 'Service';
      await this.sendToUser(
        ctx.specialistUserId,
        {
          title: 'Booking cancelled',
          body: `${ctx.clientName} cancelled: ${service}`,
        },
        { bookingId, type: 'booking_cancelled_by_client' },
      );
    } catch (e) {
      this.logger.warn(`notifySpecialistBookingCancelledByClient: ${e}`);
    }
  }

  /** Для health/dev: доступен ли Firebase Admin (без — пуши не шлём). */
  isFcmConfigured(): boolean {
    return this.fcm.isEnabled;
  }

  /**
   * Только dev-ручка: произвольный FCM (проверка токена, VAPID, сервисного ключа).
   * Не вызывать из прод-логики.
   */
  /**
   * @returns Пусто, если FCM не включён. Иначе — счётчики / ошибки (для dev-ручки).
   */
  async sendDevTestFcm(
    userId: string,
    params: { title: string; body: string },
  ): Promise<PushFcmToUserResult | null> {
    if (!this.fcm.isEnabled) {
      return null;
    }
    return this.sendToUser(
      userId,
      { title: params.title, body: params.body },
      { type: 'dev_test' },
      { webLink: '/' },
    );
  }

  private async sendToUser(
    userId: string,
    notification: { title: string; body: string },
    data: Record<string, string>,
    options?: { webLink?: string },
  ): Promise<PushFcmToUserResult> {
    const tokenStrings = await this.fcmTokens.findTokensByUserId(userId);
    if (tokenStrings.length === 0) {
      return {
        attempted: 0,
        successCount: 0,
        errors: [],
      };
    }
    const dataPayload: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      dataPayload[k] = v;
    }
    /** Веб: при notification+data иногда в onMessage / SW пустой `notification`; дублируем в data. */
    dataPayload['pushTitle'] = notification.title;
    dataPayload['pushBody'] = notification.body;
    const link =
      options?.webLink?.startsWith('/') === true ? options.webLink : '/';
    const messages: Message[] = tokenStrings.map((token) => ({
      token,
      notification,
      data: dataPayload,
      webpush: {
        /** Доставка в среде с throttling, foreground / SW — предсказуемее. */
        headers: { Urgency: 'high' },
        notification: { title: notification.title, body: notification.body },
        fcmOptions: { link },
      },
    }));
    try {
      const res = await this.fcm.messaging.sendEach(messages);
      const invalid: string[] = [];
      const errors: { code?: string; message?: string }[] = [];
      res.responses.forEach((r, i) => {
        if (r.success) {
          return;
        }
        const code = r.error?.code;
        errors.push({
          code: r.error?.code,
          message: r.error?.message,
        });
        if (code && INVALID_FCM_ERROR_CODES.has(code)) {
          invalid.push(tokenStrings[i]);
        } else {
          this.logger.debug(
            `FCM send failed: ${code ?? r.error?.message} token=…${tokenStrings[i].slice(-8)}`,
          );
        }
      });
      if (invalid.length > 0) {
        await this.fcmTokens.deleteByTokens(invalid);
        this.logger.log(
          `Pruned ${invalid.length} stale FCM token(s) (NotRegistered/invalid) from DB; user …${userId.slice(-8)} will get a new token on next app visit`,
        );
      }
      return {
        attempted: res.responses.length,
        successCount: res.successCount,
        errors,
      };
    } catch (e) {
      this.logger.warn(`FCM sendEach failed: ${e}`);
      return {
        attempted: tokenStrings.length,
        successCount: 0,
        errors: [{ message: String(e) }],
      };
    }
  }
}
