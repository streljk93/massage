import { z } from 'zod';

export const createBookingBodySchema = z.object({
  specialistId: z.string().uuid(),
  serviceId: z.string().uuid(),
  durationMinutes: z.number().int().positive(),
  /** ISO 8601 (момент начала слота в любом offset или UTC). */
  startsAt: z.string().min(1),
});

export type CreateBookingBody = z.infer<typeof createBookingBodySchema>;
