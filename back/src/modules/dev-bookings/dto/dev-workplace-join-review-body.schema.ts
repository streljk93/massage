import { z } from 'zod';

export const devWorkplaceJoinReviewBodySchema = z
  .object({
    requestId: z.string().uuid(),
    decision: z.enum(['accept', 'reject', 'block']),
  })
  .strict();

export type DevWorkplaceJoinReviewBody = z.infer<
  typeof devWorkplaceJoinReviewBodySchema
>;
