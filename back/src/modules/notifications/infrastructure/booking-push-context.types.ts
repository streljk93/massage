import type { BookingStatus } from '@prisma/client';

/** Снимок организации для писем (имя уже выбрано под локаль получателя). */
export type BookingNotificationOrganizationSnapshot = {
  displayName: string;
  addressText: string;
  /** Координаты салона для ссылки на карты; если оба заданы — приоритетнее текстового поиска. */
  latitude: number | null;
  longitude: number | null;
};

/** Контекст брони для FCM мастеру (снимок клиента + специалист). */
export type BookingPushContext = {
  categoryShortNameSnapshot: string | null;
  clientName: string;
  specialistUserId: string;
  /** Email специалиста (User.email) — дублирование пуша письмом. */
  specialistEmail: string;
  specialistName: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  statusLabel: string;
  /** Непустой пояснительный текст при отмене (клиент/мастер), иначе `null`. */
  cancellationComment: string | null;
  priceAmountSnapshot: number | null;
  currencySnapshot: string | null;
  organization: BookingNotificationOrganizationSnapshot | null;
  /** Язык письма/пуша мастеру: только сохранённый `User.locale` мастера; не задан → `en`. */
  recipientLocale: 'en' | 'ru' | 'vi';
};

/** Контекст брони для FCM клиенту (напоминание / смена статуса). */
export type ClientBookingReminderContext = {
  clientUserId: string;
  /** Email клиента (User.email). */
  clientEmail: string;
  /** Пустая строка, если снимка подкатегории нет — подставляет слой уведомлений по локали. */
  categoryShortName: string;
  specialistName: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  statusLabel: string;
  cancellationComment: string | null;
  priceAmountSnapshot: number | null;
  currencySnapshot: string | null;
  organization: BookingNotificationOrganizationSnapshot | null;
  /** Сырое `User.locale` клиента (для синка/отладки); для текстов используйте нормализацию → по умолчанию `en`. */
  clientLocale: string | null;
};

/**
 * Сигнатуры чтения контекста брони (реализует `BookingPushContextRepository`).
 * Отдельный `type` вместо класса, чтобы @typescript-eslint стабильно выводил вызовы.
 */
export type BookingPushContextReader = {
  findByBookingId(bookingId: string): Promise<BookingPushContext | null>;
  findForClientReminder(
    bookingId: string,
  ): Promise<ClientBookingReminderContext | null>;
};
