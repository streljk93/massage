import { z } from 'zod';

export const deleteCalendarBlockQuerySchema = z.object({
  version: z.coerce.number().int().min(1),
});

export type DeleteCalendarBlockQuery = z.infer<
  typeof deleteCalendarBlockQuerySchema
>;
