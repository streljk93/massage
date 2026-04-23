import { z } from 'zod';
import { BOOKING_CLIENT_CANCEL_REASON_CODES } from '../domain/booking-client-cancel-reasons';

const cancelReasonEnum = z.enum(
  BOOKING_CLIENT_CANCEL_REASON_CODES as unknown as [
    (typeof BOOKING_CLIENT_CANCEL_REASON_CODES)[number],
    ...(typeof BOOKING_CLIENT_CANCEL_REASON_CODES)[number][],
  ],
);

/**
 * Тело `POST /bookings/:id/cancel`.
 * Для `pending` поля не используются (клиент может прислать `{}` или лишние поля — сервис их игнорирует).
 * Для `confirmed` / `in_progress` сервис требует `cancelReason`; при `client_other` — непустой `cancellationComment`.
 */
export const cancelBookingBodySchema = z
  .object({
    cancelReason: cancelReasonEnum.optional(),
    cancellationComment: z.string().max(2000).optional(),
  })
  .default({});

export type CancelBookingBody = z.infer<typeof cancelBookingBodySchema>;
