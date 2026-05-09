import { z } from 'zod';

export const postSpecialistOfferingPriceOverrideBodySchema = z.object({
  offeringPriceOptionId: z.string().uuid(),
  customPrice: z.number().int().positive(),
});

export type PostSpecialistOfferingPriceOverrideBody = z.infer<
  typeof postSpecialistOfferingPriceOverrideBodySchema
>;
