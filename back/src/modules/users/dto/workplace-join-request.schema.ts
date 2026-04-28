import { z } from 'zod';

export const workplaceJoinRequestReviewBodySchema = z
  .object({
    decision: z.enum(['accept', 'reject', 'block']),
  })
  .strict();

export type WorkplaceJoinRequestReviewBody = z.infer<
  typeof workplaceJoinRequestReviewBodySchema
>;

const listStatusSchema = z.enum([
  'pending',
  'rejected',
  'blocked',
  'accepted',
  'withdrawn',
  'all',
]);

export const workplaceJoinRequestListQuerySchema = z
  .object({
    status: listStatusSchema.optional(),
  })
  .strict();

export type WorkplaceJoinRequestListQuery = z.infer<
  typeof workplaceJoinRequestListQuerySchema
>;
