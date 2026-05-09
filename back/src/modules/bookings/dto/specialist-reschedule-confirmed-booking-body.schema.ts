import { z } from 'zod';

/**
 * Тело `POST /bookings/me/:id/reschedule` — только для `confirmed`.
 * Новые `endsAt` = `startsAt + durationMinutes` брони (как при создании).
 */
export const specialistRescheduleConfirmedBookingBodySchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  /** Опциональный код причины / метка для аудита в payload события. */
  reasonCode: z.string().max(200).optional(),
});

export type SpecialistRescheduleConfirmedBookingBody = z.infer<
  typeof specialistRescheduleConfirmedBookingBodySchema
>;
