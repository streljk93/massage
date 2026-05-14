import { z } from 'zod';

export const createSpecialistWorkplaceBodySchema = z.object({
  organizationId: z.uuid(),
});

export type CreateSpecialistWorkplaceBody = z.infer<
  typeof createSpecialistWorkplaceBodySchema
>;

export const patchSpecialistWorkplaceBodySchema = z.object({
  isActive: z.boolean().optional(),
});

export type PatchSpecialistWorkplaceBody = z.infer<
  typeof patchSpecialistWorkplaceBodySchema
>;

export const patchSpecialistProfileStateBodySchema = z.object({
  isActive: z.boolean(),
});

export type PatchSpecialistProfileStateBody = z.infer<
  typeof patchSpecialistProfileStateBodySchema
>;
