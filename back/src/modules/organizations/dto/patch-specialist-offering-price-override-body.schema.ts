import { z } from 'zod';

export const patchSpecialistOfferingPriceOverrideBodySchema = z.object({
  customPrice: z.number().int().positive(),
});

export type PatchSpecialistOfferingPriceOverrideBody = z.infer<
  typeof patchSpecialistOfferingPriceOverrideBodySchema
>;
