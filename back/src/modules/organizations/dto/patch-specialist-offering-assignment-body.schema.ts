import { z } from 'zod';
import { SpecialistOfferingStatus } from '@prisma/client';

export const patchSpecialistOfferingAssignmentBodySchema = z.object({
  status: z.nativeEnum(SpecialistOfferingStatus),
});

export type PatchSpecialistOfferingAssignmentBody = z.infer<
  typeof patchSpecialistOfferingAssignmentBodySchema
>;
