import { z } from 'zod';

export const createBookingBodySchema = z.object({
  specialistId: z.string().uuid(),
  /** ISO 8601 (момент начала слота в любом offset или UTC). */
  startsAt: z.string().min(1),
  /**
   * Опционально: если передано, должно совпадать с длительностью выбранной ценовой опции (`OfferingPriceOption.durationMinutes`).
   */
  durationMinutes: z.number().int().positive().optional(),
  organizationOfferingId: z.string().uuid(),
  offeringPriceOptionId: z.string().uuid(),
});

export type CreateBookingBody = z.infer<typeof createBookingBodySchema>;
