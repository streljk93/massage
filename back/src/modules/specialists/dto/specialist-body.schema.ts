import { z } from 'zod';

const phoneSchema = z.string().min(1).max(32);

const specialistOnboardingMassageBodySchema = z
  .object({
    pressureLevel: z.number().int().min(1).max(5).optional(),
    pressureAdaptsToClient: z.boolean().optional(),
  })
  .strict();

export const patchSpecialistProfileBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  gender: z.enum(['male', 'female']).optional(),
  phone: z.union([phoneSchema, z.null()]).optional(),
  bio: z.string().min(1).max(4000).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  imageUrl: z.string().min(1).max(2048).nullable().optional(),
  imageAlt: z.string().min(1).max(500).nullable().optional(),
  /** Параметры вертикали «массаж»; для стоматологии и т.д. — отдельные блоки. */
  massage: specialistOnboardingMassageBodySchema.optional(),
});

export type PatchSpecialistProfileBody = z.infer<
  typeof patchSpecialistProfileBodySchema
>;
