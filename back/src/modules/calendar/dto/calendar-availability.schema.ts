import { z } from 'zod';

export const availabilityRuleBodySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(1).max(1440),
    type: z.enum(['working', 'break']).default('working'),
  })
  .strict()
  .refine((v) => v.endMinute > v.startMinute, {
    message: 'endMinute must be after startMinute',
  });

export const putAvailabilityRulesBodySchema = z
  .object({
    rules: z.array(availabilityRuleBodySchema).max(28),
  })
  .strict();

export const putAvailabilityRulesBulkBodySchema = z
  .object({
    resourceIds: z.array(z.string().uuid()).min(1).max(100),
    rules: z.array(availabilityRuleBodySchema).max(28),
  })
  .strict();

export const availabilityOverrideBodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    type: z.enum(['off', 'extra']),
  })
  .strict();

export type PutAvailabilityRulesBody = z.infer<
  typeof putAvailabilityRulesBodySchema
>;
export type PutAvailabilityRulesBulkBody = z.infer<
  typeof putAvailabilityRulesBulkBodySchema
>;
export type AvailabilityOverrideBody = z.infer<
  typeof availabilityOverrideBodySchema
>;
