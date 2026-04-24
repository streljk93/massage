/** Контекст брони для FCM мастеру (снимок клиента + специалист). */
export type BookingPushContext = {
  serviceNameSnapshot: string | null;
  clientName: string;
  specialistUserId: string;
};

/** Контекст брони для FCM клиенту (напоминание / смена статуса). */
export type ClientBookingReminderContext = {
  clientUserId: string;
  serviceName: string;
  specialistName: string;
  startsAt: Date;
  /// BCP-47 подмножество: en, ru, vi — для `Intl` и пути /{locale}/bookings
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
