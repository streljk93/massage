import { CalendarBlockReason } from '@prisma/client';
import { z } from 'zod';

export const createCalendarBlockBodySchema = z.object({
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  resourceIds: z.array(z.string().uuid()).min(1),
  blockReason: z.enum([
    CalendarBlockReason.break,
    CalendarBlockReason.vacation,
    CalendarBlockReason.manual,
  ]),
  notes: z.string().max(1000).optional(),
});

export type CreateCalendarBlockBody = z.infer<
  typeof createCalendarBlockBodySchema
>;
