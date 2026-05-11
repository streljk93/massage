import { CalendarBlockReason } from '@prisma/client';
import { z } from 'zod';

export const updateCalendarBlockBodySchema = z.object({
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  resourceIds: z.array(z.string().uuid()).min(1),
  blockReason: z
    .enum([
      CalendarBlockReason.break,
      CalendarBlockReason.vacation,
      CalendarBlockReason.manual,
    ])
    .optional(),
  notes: z.string().max(1000).nullable().optional(),
  version: z.number().int().min(1),
});

export type UpdateCalendarBlockBody = z.infer<
  typeof updateCalendarBlockBodySchema
>;
