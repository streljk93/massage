import { z } from 'zod';

export const postSpecialistOfferingAssignmentBodySchema = z.object({
  specialistId: z.string().uuid(),
});

export type PostSpecialistOfferingAssignmentBody = z.infer<
  typeof postSpecialistOfferingAssignmentBodySchema
>;
