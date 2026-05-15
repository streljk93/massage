import { z } from 'zod';
import { requestLocaleQueryFieldSchema } from '../../../common/i18n';

const organizationOfferingLocaleBodySchema = z.object({
  locale: requestLocaleQueryFieldSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
});

export const createOrganizationOfferingDraftBodySchema = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.string().uuid(),
  description: z.string().max(5000).optional().nullable(),
  bodyZoneIds: z.array(z.string().uuid()).optional(),
  locales: z.array(organizationOfferingLocaleBodySchema).optional(),
});

export type CreateOrganizationOfferingDraftBody = z.infer<
  typeof createOrganizationOfferingDraftBodySchema
>;
