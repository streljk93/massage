import { z } from 'zod';

export const devModerationResolveBodySchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    /** Обязательно при `decision: reject` — фиксируется в кейсе (`moderatorReason`). */
    reason: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'reject') {
      const t = data.reason?.trim() ?? '';
      if (t.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'reason is required when decision is reject',
          path: ['reason'],
        });
      }
    }
  });

export type DevModerationResolveBody = z.infer<
  typeof devModerationResolveBodySchema
>;
