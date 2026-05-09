import { z } from 'zod';

export const postOfferingPriceOptionBodySchema = z.object({
  durationMinutes: z.number().int().positive().max(1440),
  priceAmount: z.number().int().nonnegative(),
  currency: z.string().min(1).max(8).optional(),
});

export type PostOfferingPriceOptionBody = z.infer<
  typeof postOfferingPriceOptionBodySchema
>;
