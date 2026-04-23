import { z } from 'zod';

export const patchSpecialistActiveOrganizationBodySchema = z.object({
  organizationId: z.uuid(),
});

export type PatchSpecialistActiveOrganizationBody = z.infer<
  typeof patchSpecialistActiveOrganizationBodySchema
>;
