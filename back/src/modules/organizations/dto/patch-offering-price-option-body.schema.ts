import { z } from 'zod';
import { OfferingPriceOptionStatus } from '@prisma/client';

export const patchOfferingPriceOptionBodySchema = z.object({
  status: z.nativeEnum(OfferingPriceOptionStatus).optional(),
  /** Если true — мягкое удаление (soft-delete строки опции). */
  remove: z.boolean().optional(),
  priceAmount: z.number().int().nonnegative().optional(),
});

export type PatchOfferingPriceOptionBody = z.infer<
  typeof patchOfferingPriceOptionBodySchema
>;
