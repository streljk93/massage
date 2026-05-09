import { z } from 'zod';

export const patchSpecialistSkillsBodySchema = z
  .object({
    serviceCategoryIds: z.array(z.string().uuid()).max(80),
  })
  .strict();

export type PatchSpecialistSkillsBody = z.infer<
  typeof patchSpecialistSkillsBodySchema
>;
