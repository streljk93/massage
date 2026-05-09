import { z } from 'zod';

export const patchOrganizationOfferingBodySchema = z.object({
  title: z.string().min(1).max(512).optional(),
  description: z.string().nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab lowercase')
    .optional(),
  categoryId: z.string().uuid().optional(),
});

export type PatchOrganizationOfferingBody = z.infer<
  typeof patchOrganizationOfferingBodySchema
>;
