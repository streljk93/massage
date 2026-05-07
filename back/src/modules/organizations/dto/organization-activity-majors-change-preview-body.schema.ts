import { z } from 'zod';

/** Превью: планируемый набор больших категорий сравнивается с текущим в БД. */
export const organizationActivityMajorsChangePreviewBodySchema = z
  .object({
    majorCategorySlugs: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(20),
  })
  .strict();

export type OrganizationActivityMajorsChangePreviewBody = z.infer<
  typeof organizationActivityMajorsChangePreviewBodySchema
>;
