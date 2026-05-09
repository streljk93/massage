import { z } from 'zod';

export const createOrganizationOfferingDraftBodySchema = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.string().uuid(),
  description: z.string().max(5000).optional().nullable(),
});

export type CreateOrganizationOfferingDraftBody = z.infer<
  typeof createOrganizationOfferingDraftBodySchema
>;
