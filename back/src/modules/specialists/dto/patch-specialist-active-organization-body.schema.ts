import { z } from 'zod';

/** UUID места приёма или `null` — снять флаг: новые записи к мастеру через салон не принимаются, пока снова не выбрано место приёма. */
export const patchSpecialistActiveOrganizationBodySchema = z.object({
  organizationId: z.union([z.uuid(), z.null()]),
});

export type PatchSpecialistActiveOrganizationBody = z.infer<
  typeof patchSpecialistActiveOrganizationBodySchema
>;
