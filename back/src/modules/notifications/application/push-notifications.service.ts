import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type BookingStatus } from '@prisma/client';
import type { Message } from 'firebase-admin/messaging';
import { localeFromSavedUserProfile } from '../../../common/i18n';
import { mailHeroImageUrlFromConfig } from '../../../infrastructure/mail/mail-hero-image';
import { MailService } from '../../../infrastructure/mail/mail.service';
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

/** Подписи строк карточки брони в письмах (как на клиентской карточке). */
const BOOKING_EMAIL_CARD_LABELS: Record<
  'en' | 'ru' | 'vi',
  {
    specialist: string;
    client: string;
    service: string;
    price: string;
    salon: string;
    address: string;
    visit: string;
    status: string;
  }
> = {
  en: {
    specialist: 'Specialist',
    client: 'Client',
    service: 'Service',
    price: 'Price',
    salon: 'Salon',
    address: 'Address',
    visit: 'Date & time',
    status: 'Status',
  },
  ru: {
    specialist: 'Мастер',
    client: 'Клиент',
    service: 'Услуга',
    price: 'Стоимость',
    salon: 'Салон',
    address: 'Адрес',
    visit: 'Дата и время',
    status: 'Статус',
  },
  vi: {
    specialist: 'Chuyên gia',
    client: 'Khách hàng',
    service: 'Dịch vụ',
    price: 'Giá',
    salon: 'Salon',
    address: 'Địa chỉ',
    visit: 'Ngày & giờ',
    status: 'Trạng thái',
  },
};

const SERVICE_NAME_FALLBACK: Record<'en' | 'ru' | 'vi', string> = {
  en: 'Service',
  ru: 'Услуга',
  vi: 'Dịch vụ',
};

/** Подпись блока с `Booking.cancellationComment` в письме о брони (после таблицы). */
const BOOKING_EMAIL_CANCELLATION_NOTE_LABEL: Record<
  'en' | 'ru' | 'vi',
  string
> = {
  en: 'Cancellation note',
  ru: 'Комментарий к отмене',
  vi: 'Ghi chú hủy lịch',
};

/** Кнопка в письме «скоро визит» (ведёт на список записей клиента). */
const REMINDER_EMAIL_CTA: Record<'en' | 'ru' | 'vi', string> = {
  en: 'My bookings',
  ru: 'Мои записи',
  vi: 'Lịch của tôi',
};

/** Клиент: перенос времени подтверждённой записи мастером/салоном (статус тот же `confirmed`). */
const CLIENT_BOOKING_RESCHEDULED_COPY: Record<
  'en' | 'ru' | 'vi',
  { title: string; bodyPrefix: string }
> = {
  en: {
    title: 'Appointment rescheduled',
    bodyPrefix: 'New time',
  },
  ru: {
    title: 'Запись перенесена',
    bodyPrefix: 'Новое время',
  },
  vi: {
    title: 'Đã đổi lịch',
    bodyPrefix: 'Giờ hẹn mới',
  },
};

/** Тема и короткий текст письма/пуша мастеру — на той же локали, что и таблица в письме. */
const SPECIALIST_BOOKING_NOTIFY_COPY: Record<
  'en' | 'ru' | 'vi',
  {
    newBookingTitle: string;
    cancelledByClientTitle: string;
    cancelledByClientBody: (clientName: string, service: string) => string;
  }
> = {
  en: {
    newBookingTitle: 'New booking',
    cancelledByClientTitle: 'Booking cancelled',
    cancelledByClientBody: (c, s) => `${c} cancelled: ${s}`,
  },
  ru: {
    newBookingTitle: 'Новая запись',
    cancelledByClientTitle: 'Запись отменена',
    cancelledByClientBody: (c, s) => `Отмена клиентом ${c}: ${s}`,
  },
  vi: {
    newBookingTitle: 'Lịch hẹn mới',
    cancelledByClientTitle: 'Lịch đã bị hủy',
    cancelledByClientBody: (c, s) => `${c} đã hủy lịch: ${s}`,
  },
};

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
    private readonly mail: MailService,
    private readonly config: ConfigService,
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
   * **Только email** не шлём при переходе **в `pending`** и при **`confirmed` → `in_progress`**
   * (FCM при этом остаётся).
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
      const skipEmailOnly =
        toStatus === 'pending' ||
        (fromStatus === 'confirmed' && toStatus === 'in_progress');
      const ctx = await findClientReminderContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const loc = localeFromSavedUserProfile(ctx.clientLocale);
      const serviceDisplay = this.displayServiceName(
        ctx.categoryShortName,
        loc,
      );
      const timeLabel = this.formatLocalAppointmentTime(ctx.startsAt, loc);
      const { title, body } = this.clientBookingStatusCopy(loc, toStatus, {
        service: serviceDisplay,
        specialist: ctx.specialistName,
        timeLabel,
      });
      const webLink = `/${loc}/bookings`;
      if (this.fcm.isEnabled) {
        await this.sendToUser(
          ctx.clientUserId,
          { title, body },
          {
            bookingId: String(bookingId),
            type: 'booking_status',
            toStatus: String(toStatus),
            timeLabel,
            categoryShortName: serviceDisplay,
            specialistName: ctx.specialistName,
          },
          { webLink },
        );
      }
      if (!skipEmailOnly) {
        const emailCard = {
          loc,
          audience: 'client' as const,
          specialistName: ctx.specialistName,
          clientName: '',
          serviceName: serviceDisplay,
          priceLine: this.formatPriceLine(
            ctx.priceAmountSnapshot,
            ctx.currencySnapshot,
            loc,
          ),
          salonName: ctx.organization?.displayName ?? '—',
          addressText: ctx.organization?.addressText ?? '—',
          addressLatitude: ctx.organization?.latitude ?? null,
          addressLongitude: ctx.organization?.longitude ?? null,
          appointmentText: this.formatBookingAppointmentRange(
            ctx.startsAt,
            ctx.endsAt,
            loc,
          ),
          statusText: ctx.statusLabel,
          cancellationComment: ctx.cancellationComment,
        };
        const mailParts = this.buildBookingEmailParts(title, emailCard);
        void this.mail.sendTransactionalNotification({
          to: ctx.clientEmail,
          subject: title,
          text: mailParts.text,
          template: mailParts.template,
          resendTags: [
            { name: 'booking_event', value: 'client_status' },
            { name: 'to_status', value: String(toStatus) },
          ],
        });
      }
    } catch (e) {
      this.logger.warn(`notifyClientBookingStatusChange: ${e}`);
    }
  }

  /**
   * Клиент: мастер/салон перенёс подтверждённый визит (`BookingEventType.rescheduled`).
   * Статус в БД остаётся `confirmed`, поэтому отдельный канал вместо {@link notifyClientBookingStatusChange}.
   */
  async notifyClientBookingRescheduled(bookingId: string): Promise<void> {
    try {
      const ctx = await findClientReminderContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const loc = localeFromSavedUserProfile(ctx.clientLocale);
      const serviceDisplay = this.displayServiceName(
        ctx.categoryShortName,
        loc,
      );
      const timeLabel = this.formatLocalAppointmentTime(ctx.startsAt, loc);
      const line = `${timeLabel} · ${serviceDisplay} · ${ctx.specialistName}`;
      const copy = CLIENT_BOOKING_RESCHEDULED_COPY[loc];
      const title = copy.title;
      const body = `${copy.bodyPrefix} — ${line}`;
      const webLink = `/${loc}/bookings`;
      if (this.fcm.isEnabled) {
        await this.sendToUser(
          ctx.clientUserId,
          { title, body },
          {
            bookingId: String(bookingId),
            type: 'booking_rescheduled',
            toStatus: 'confirmed',
            timeLabel,
            categoryShortName: serviceDisplay,
            specialistName: ctx.specialistName,
          },
          { webLink },
        );
      }
      const emailCard = {
        loc,
        audience: 'client' as const,
        specialistName: ctx.specialistName,
        clientName: '',
        serviceName: serviceDisplay,
        priceLine: this.formatPriceLine(
          ctx.priceAmountSnapshot,
          ctx.currencySnapshot,
          loc,
        ),
        salonName: ctx.organization?.displayName ?? '—',
        addressText: ctx.organization?.addressText ?? '—',
        addressLatitude: ctx.organization?.latitude ?? null,
        addressLongitude: ctx.organization?.longitude ?? null,
        appointmentText: this.formatBookingAppointmentRange(
          ctx.startsAt,
          ctx.endsAt,
          loc,
        ),
        statusText: ctx.statusLabel,
        cancellationComment: ctx.cancellationComment,
      };
      const mailParts = this.buildBookingEmailParts(title, emailCard);
      void this.mail.sendTransactionalNotification({
        to: ctx.clientEmail,
        subject: title,
        text: mailParts.text,
        template: mailParts.template,
        resendTags: [
          { name: 'booking_event', value: 'client_rescheduled' },
          { name: 'to_status', value: 'confirmed' },
        ],
      });
    } catch (e) {
      this.logger.warn(`notifyClientBookingRescheduled: ${e}`);
    }
  }

  /**
   * Новая бронь: только **мастеру** (FCM + письмо). Клиент не уведомляется — он только что создал запись.
   * Не зависит от настроек напоминаний.
   */
  async notifySpecialistNewBooking(bookingId: string): Promise<void> {
    try {
      const ctx = await findSpecialistPushContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const loc = ctx.recipientLocale;
      const copy = SPECIALIST_BOOKING_NOTIFY_COPY[loc];
      const serviceDisplay = this.displayServiceName(
        ctx.categoryShortNameSnapshot?.trim() ?? '',
        loc,
      );
      const title = copy.newBookingTitle;
      const body = `${ctx.clientName}: ${serviceDisplay}`;
      if (this.fcm.isEnabled) {
        await this.sendToUser(
          ctx.specialistUserId,
          { title, body },
          { bookingId, type: 'booking_new' },
        );
      }

      const specialistEmailCard = {
        loc,
        audience: 'specialist' as const,
        specialistName: ctx.specialistName,
        clientName: ctx.clientName,
        serviceName: serviceDisplay,
        priceLine: this.formatPriceLine(
          ctx.priceAmountSnapshot,
          ctx.currencySnapshot,
          loc,
        ),
        salonName: ctx.organization?.displayName ?? '—',
        addressText: ctx.organization?.addressText ?? '—',
        addressLatitude: ctx.organization?.latitude ?? null,
        addressLongitude: ctx.organization?.longitude ?? null,
        appointmentText: this.formatBookingAppointmentRange(
          ctx.startsAt,
          ctx.endsAt,
          loc,
        ),
        statusText: ctx.statusLabel,
        cancellationComment: null,
      };
      const specialistMailParts = this.buildBookingEmailParts(
        title,
        specialistEmailCard,
      );
      void this.mail.sendTransactionalNotification({
        to: ctx.specialistEmail,
        subject: title,
        text: specialistMailParts.text,
        template: specialistMailParts.template,
        resendTags: [{ name: 'booking_event', value: 'specialist_new' }],
      });
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
      const loc = localeFromSavedUserProfile(ctx.clientLocale);
      const serviceDisplay = this.displayServiceName(
        ctx.categoryShortName,
        loc,
      );
      const timeLabel = this.formatLocalAppointmentTime(ctx.startsAt, loc);
      const { title, body } = this.clientReminderCopy(loc, {
        service: serviceDisplay,
        specialist: ctx.specialistName,
        timeLabel,
      });
      const webLink = `/${loc}/bookings`;
      if (this.fcm.isEnabled) {
        await this.sendToUser(
          ctx.clientUserId,
          { title, body },
          {
            bookingId: String(bookingId),
            type: 'booking_client_reminder',
            timeLabel,
            categoryShortName: serviceDisplay,
            specialistName: ctx.specialistName,
          },
          { webLink },
        );
      }
      const mailParts = this.buildBookingReminderEmailParts(title, loc, {
        specialistName: ctx.specialistName,
        serviceName: serviceDisplay,
        salonName: ctx.organization?.displayName ?? '—',
        addressText: ctx.organization?.addressText ?? '—',
        addressLatitude: ctx.organization?.latitude ?? null,
        addressLongitude: ctx.organization?.longitude ?? null,
        appointmentText: this.formatBookingAppointmentRange(
          ctx.startsAt,
          ctx.endsAt,
          loc,
        ),
      });
      void this.mail.sendTransactionalNotification({
        to: ctx.clientEmail,
        subject: title,
        text: mailParts.text,
        template: mailParts.template,
        resendTags: [{ name: 'booking_event', value: 'client_reminder' }],
      });
    } catch (e) {
      this.logger.warn(`notifyClientBookingReminder: ${e}`);
    }
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
      const ctx = await findSpecialistPushContext(
        this.bookingContext,
        bookingId,
      );
      if (!ctx) {
        return;
      }
      const loc = ctx.recipientLocale;
      const copy = SPECIALIST_BOOKING_NOTIFY_COPY[loc];
      const serviceDisplay = this.displayServiceName(
        ctx.categoryShortNameSnapshot?.trim() ?? '',
        loc,
      );
      const title = copy.cancelledByClientTitle;
      const body = copy.cancelledByClientBody(ctx.clientName, serviceDisplay);
      const emailCard = {
        loc,
        audience: 'specialist' as const,
        specialistName: ctx.specialistName,
        clientName: ctx.clientName,
        serviceName: serviceDisplay,
        priceLine: this.formatPriceLine(
          ctx.priceAmountSnapshot,
          ctx.currencySnapshot,
          loc,
        ),
        salonName: ctx.organization?.displayName ?? '—',
        addressText: ctx.organization?.addressText ?? '—',
        addressLatitude: ctx.organization?.latitude ?? null,
        addressLongitude: ctx.organization?.longitude ?? null,
        appointmentText: this.formatBookingAppointmentRange(
          ctx.startsAt,
          ctx.endsAt,
          loc,
        ),
        statusText: ctx.statusLabel,
        cancellationComment: ctx.cancellationComment,
      };
      if (this.fcm.isEnabled) {
        await this.sendToUser(
          ctx.specialistUserId,
          { title, body },
          { bookingId, type: 'booking_cancelled_by_client' },
        );
      }
      const mailParts = this.buildBookingEmailParts(title, emailCard);
      void this.mail.sendTransactionalNotification({
        to: ctx.specialistEmail,
        subject: title,
        text: mailParts.text,
        template: mailParts.template,
        resendTags: [{ name: 'booking_event', value: 'cancelled_by_client' }],
      });
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

  /** Письмо «скоро визит»: заголовок, одна строка деталей, кнопка; hero из `client/public`. */
  private buildBookingReminderEmailParts(
    title: string,
    loc: 'en' | 'ru' | 'vi',
    card: {
      specialistName: string;
      serviceName: string;
      salonName: string;
      addressText: string;
      addressLatitude: number | null;
      addressLongitude: number | null;
      appointmentText: string;
    },
  ): {
    text: string;
    template: { slug: string; variables: Record<string, string> };
  } {
    const origin = (
      this.config.get<string>('mail.clientAppOrigin') ?? ''
    ).replace(/\/$/, '');
    const heroImageUrl = mailHeroImageUrlFromConfig(this.config);
    const ctaPath = `/${loc}/bookings`;
    const ctaUrl = origin ? `${origin}${ctaPath}` : ctaPath;
    return {
      text: this.bookingReminderPlainText(title, card, ctaUrl),
      template: {
        slug: 'booking-reminder',
        variables: this.bookingReminderMjVariables(
          title,
          loc,
          card,
          heroImageUrl,
          ctaUrl,
        ),
      },
    };
  }

  /** Одна строка для письма: дата/время · услуга · мастер · адрес (адрес со ссылкой на карты при возможности). */
  private bookingReminderDetailLineHtml(card: {
    specialistName: string;
    serviceName: string;
    addressText: string;
    addressLatitude: number | null;
    addressLongitude: number | null;
    appointmentText: string;
  }): string {
    const esc = (s: string) => this.escapeMailPlaceholder(s);
    const addrHtml = this.bookingReminderAddressSuffixHtml(
      card.addressText,
      card.addressLatitude,
      card.addressLongitude,
    );
    return `${esc(card.appointmentText)} · ${esc(card.serviceName)} · ${esc(card.specialistName)} · ${addrHtml}`;
  }

  private bookingReminderAddressSuffixHtml(
    addressText: string,
    latitude: number | null,
    longitude: number | null,
  ): string {
    const esc = (s: string) => this.escapeMailPlaceholder(s);
    const t = addressText.trim();
    if (t.length === 0 || t === '—') {
      return esc('—');
    }
    const url = this.googleMapsUrlForBookingLocation(
      addressText,
      latitude,
      longitude,
    );
    if (!url) {
      return esc(t);
    }
    return `<a href="${url}" style="color:#2563eb;text-decoration:underline;" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`;
  }

  private bookingReminderMjVariables(
    title: string,
    loc: 'en' | 'ru' | 'vi',
    card: {
      specialistName: string;
      serviceName: string;
      salonName: string;
      addressText: string;
      addressLatitude: number | null;
      addressLongitude: number | null;
      appointmentText: string;
    },
    heroImageUrl: string,
    ctaUrl: string,
  ): Record<string, string> {
    const esc = (s: string) => this.escapeMailPlaceholder(s);
    const detailPlain = this.bookingReminderDetailLinePlain(card);
    const previewRaw =
      detailPlain.length > 140 ? `${detailPlain.slice(0, 137)}…` : detailPlain;
    return {
      title: esc(title),
      preview: esc(previewRaw),
      heroImageUrl: esc(heroImageUrl),
      detailLineHtml: this.bookingReminderDetailLineHtml(card),
      ctaLabel: esc(REMINDER_EMAIL_CTA[loc]),
      ctaUrl: esc(ctaUrl),
    };
  }

  private bookingReminderDetailLinePlain(card: {
    specialistName: string;
    serviceName: string;
    addressText: string;
    addressLatitude: number | null;
    addressLongitude: number | null;
    appointmentText: string;
  }): string {
    const addr =
      card.addressText.trim().length > 0 && card.addressText.trim() !== '—'
        ? card.addressText.trim()
        : '—';
    const mapsUrl = this.googleMapsUrlForBookingLocation(
      card.addressText,
      card.addressLatitude,
      card.addressLongitude,
    );
    const core = [
      card.appointmentText,
      card.serviceName,
      card.specialistName,
      addr,
    ].join(' · ');
    return mapsUrl ? `${core}\n${mapsUrl}` : core;
  }

  private bookingReminderPlainText(
    title: string,
    card: {
      specialistName: string;
      serviceName: string;
      salonName: string;
      addressText: string;
      addressLatitude: number | null;
      addressLongitude: number | null;
      appointmentText: string;
    },
    ctaUrl: string,
  ): string {
    return [
      title,
      '',
      this.bookingReminderDetailLinePlain(card),
      '',
      ctaUrl,
    ].join('\n');
  }

  private buildBookingEmailParts(
    title: string,
    card: {
      loc: 'en' | 'ru' | 'vi';
      audience: 'client' | 'specialist';
      specialistName: string;
      clientName: string;
      serviceName: string;
      priceLine: string;
      salonName: string;
      addressText: string;
      addressLatitude: number | null;
      addressLongitude: number | null;
      appointmentText: string;
      statusText: string;
      cancellationComment?: string | null;
    },
  ): {
    text: string;
    template: { slug: string; variables: Record<string, string> };
  } {
    return {
      text: `${title}\n\n${this.bookingDetailsPlainText(card)}`,
      template: {
        slug: 'booking-notification',
        variables: this.bookingNotificationMjVariables(title, card),
      },
    };
  }

  /** Плейсхолдеры для `mail-templates/mjml/booking-notification.mjml` (текст экранирован; `addressRowHtml` — безопасный фрагмент с `<a>`). */
  private bookingNotificationMjVariables(
    title: string,
    card: {
      loc: 'en' | 'ru' | 'vi';
      audience: 'client' | 'specialist';
      specialistName: string;
      clientName: string;
      serviceName: string;
      priceLine: string;
      salonName: string;
      addressText: string;
      addressLatitude: number | null;
      addressLongitude: number | null;
      appointmentText: string;
      statusText: string;
      cancellationComment?: string | null;
    },
  ): Record<string, string> {
    const L = BOOKING_EMAIL_CARD_LABELS[card.loc];
    const esc = (s: string) => this.escapeMailPlaceholder(s);
    const primary =
      card.audience === 'client'
        ? {
            primaryRowLabel: esc(L.specialist),
            primaryRowValue: esc(card.specialistName),
          }
        : {
            primaryRowLabel: esc(L.client),
            primaryRowValue: esc(card.clientName),
          };
    return {
      title: esc(title),
      preview: esc(title),
      heroImageUrl: esc(mailHeroImageUrlFromConfig(this.config)),
      ...primary,
      serviceRowLabel: esc(L.service),
      serviceRowValue: esc(card.serviceName),
      priceRowLabel: esc(L.price),
      priceRowValue: esc(card.priceLine),
      salonRowLabel: esc(L.salon),
      salonRowValue: esc(card.salonName),
      addressRowLabel: esc(L.address),
      addressRowHtml: this.bookingAddressRowHtml(
        card.addressText,
        card.addressLatitude,
        card.addressLongitude,
      ),
      visitRowLabel: esc(L.visit),
      visitRowValue: esc(card.appointmentText),
      statusRowLabel: esc(L.status),
      statusRowValue: esc(card.statusText),
      bookingCardFooterHtml: this.bookingNotificationCardFooterHtml(
        card.loc,
        card.cancellationComment,
      ),
    };
  }

  /**
   * HTML после таблицы в `booking-notification`: нижний отступ карточки или блок с `cancellationComment`.
   * Обязательно `<tr><td>…</td></tr>`: иначе `mj-raw` даёт `<div>` внутри `<tbody>` рядом с `<tr>` — в почте блок
   * может оказаться сверху карточки.
   */
  private bookingNotificationCardFooterHtml(
    loc: 'en' | 'ru' | 'vi',
    cancellationComment: string | null | undefined,
  ): string {
    const text = cancellationComment?.trim() ?? '';
    const esc = (s: string) => this.escapeMailPlaceholder(s);
    const row = (inner: string) =>
      `<tr><td style="padding:0;border-collapse:separate;">${inner}</td></tr>`;
    if (!text) {
      return row(
        `<div style="font-size:0;line-height:24px;padding-bottom:24px;mso-line-height-rule:exactly;">&nbsp;</div>`,
      );
    }
    const label = BOOKING_EMAIL_CANCELLATION_NOTE_LABEL[loc];
    const inner =
      `<div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;padding-bottom:24px;">` +
      `<div style="padding:16px 20px 0 20px;">` +
      `<div style="font-size:13px;font-weight:600;color:#52525b;line-height:18px;margin:0 0 6px 0;">${esc(label)}</div>` +
      `<div style="font-size:15px;line-height:22px;color:#18181b;white-space:pre-wrap;margin:0;">${esc(text)}</div>` +
      `</div></div>`;
    return row(inner);
  }

  private bookingDetailsPlainText(card: {
    loc: 'en' | 'ru' | 'vi';
    audience: 'client' | 'specialist';
    specialistName: string;
    clientName: string;
    serviceName: string;
    priceLine: string;
    salonName: string;
    addressText: string;
    addressLatitude: number | null;
    addressLongitude: number | null;
    appointmentText: string;
    statusText: string;
    cancellationComment?: string | null;
  }): string {
    const L = BOOKING_EMAIL_CARD_LABELS[card.loc];
    const mapsUrl = this.googleMapsUrlForBookingLocation(
      card.addressText,
      card.addressLatitude,
      card.addressLongitude,
    );
    const addressBlock = mapsUrl
      ? `${card.addressText}\n${mapsUrl}`
      : card.addressText;
    const pairs: [string, string][] =
      card.audience === 'client'
        ? [
            [L.specialist, card.specialistName],
            [L.service, card.serviceName],
            [L.price, card.priceLine],
            [L.salon, card.salonName],
            [L.address, addressBlock],
            [L.visit, card.appointmentText],
            [L.status, card.statusText],
          ]
        : [
            [L.client, card.clientName],
            [L.service, card.serviceName],
            [L.price, card.priceLine],
            [L.salon, card.salonName],
            [L.address, addressBlock],
            [L.visit, card.appointmentText],
            [L.status, card.statusText],
          ];
    const lines = pairs.map(([k, v]) => `${k}: ${v}`).join('\n');
    const note = card.cancellationComment?.trim();
    if (!note) {
      return lines;
    }
    return `${lines}\n\n${BOOKING_EMAIL_CANCELLATION_NOTE_LABEL[card.loc]}: ${note}`;
  }

  private displayServiceName(
    rawFromContext: string,
    loc: 'en' | 'ru' | 'vi',
  ): string {
    const t = rawFromContext.trim();
    if (t.length > 0) {
      return t;
    }
    return SERVICE_NAME_FALLBACK[loc];
  }

  private formatPriceLine(
    amount: number | null,
    currency: string | null,
    loc: 'en' | 'ru' | 'vi',
  ): string {
    if (amount == null) {
      return '—';
    }
    const c = (currency ?? 'VND').toUpperCase();
    try {
      return new Intl.NumberFormat(
        loc === 'en' ? 'en' : loc === 'ru' ? 'ru' : 'vi-VN',
        { style: 'currency', currency: c },
      ).format(amount);
    } catch {
      return `${amount} ${c}`;
    }
  }

  /** Дата и интервал времени визита (как на клиенте: Asia/Ho_Chi_Minh). */
  private formatBookingAppointmentRange(
    startsAt: Date,
    endsAt: Date,
    loc: 'en' | 'ru' | 'vi',
  ): string {
    const tz = 'Asia/Ho_Chi_Minh';
    const locale = loc === 'en' ? 'en' : loc === 'ru' ? 'ru' : 'vi-VN';
    const dtfDate = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: tz,
    });
    const dtfTime = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
    return `${dtfDate.format(startsAt)}, ${dtfTime.format(startsAt)} – ${dtfTime.format(endsAt)}`;
  }

  /**
   * Ссылка на Google Maps: при валидной паре координат — `query=lat,lng`,
   * иначе поиск по тексту адреса (если не «—» и не пусто).
   */
  private googleMapsUrlForBookingLocation(
    addressText: string,
    latitude: number | null,
    longitude: number | null,
  ): string | null {
    if (
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    const t = addressText.trim();
    if (t.length === 0 || t === '—') {
      return null;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
  }

  /** Ячейка адреса в MJML: ссылка на карты или экранированный текст как раньше. */
  private bookingAddressRowHtml(
    addressText: string,
    latitude: number | null,
    longitude: number | null,
  ): string {
    const esc = (s: string) => this.escapeMailPlaceholder(s);
    const url = this.googleMapsUrlForBookingLocation(
      addressText,
      latitude,
      longitude,
    );
    if (!url) {
      return esc(addressText);
    }
    return `<a href="${url}" style="color:#2563eb;text-decoration:underline;" target="_blank" rel="noopener noreferrer">${esc(addressText)}</a>`;
  }

  /** Экранирование для подстановки в скомпилированный MJML (HTML-текстовые узлы). */
  private escapeMailPlaceholder(s: string): string {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
