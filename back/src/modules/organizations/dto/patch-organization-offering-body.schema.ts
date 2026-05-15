import { z } from 'zod';
import { requestLocaleQueryFieldSchema } from '../../../common/i18n';

const organizationOfferingLocalePatchSchema = z.object({
  locale: requestLocaleQueryFieldSchema,
  title: z.string().min(1).max(512),
  description: z.string().max(5000).nullable().optional(),
});

export const patchOrganizationOfferingBodySchema = z.object({
  title: z.string().min(1).max(512).optional(),
  description: z.string().nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab lowercase')
    .optional(),
  categoryId: z.string().uuid().optional(),
  bodyZoneIds: z.array(z.string().uuid()).optional(),
  locales: z.array(organizationOfferingLocalePatchSchema).optional(),
});

export type PatchOrganizationOfferingBody = z.infer<
  typeof patchOrganizationOfferingBodySchema
>;
