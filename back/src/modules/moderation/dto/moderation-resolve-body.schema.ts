import { z } from 'zod';

export const moderationRejectBodySchema = z.object({
  reason: z.string().min(1).max(2000).trim(),
});

export type ModerationRejectBody = z.infer<typeof moderationRejectBodySchema>;
