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

export const createSpecialistPersonalServiceBodySchema = z
  .object({
    categoryId: z.string().uuid(),
    kind: z.enum(['standard', 'combo']).optional(),
    comboCategoryIds: z.array(z.string().uuid()).max(20).optional(),
    bodyZoneSlugs: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(24)
      .optional(),
    description: z.string().max(4000).optional(),
    priceOptions: z
      .array(
        z.object({
          durationMinutes: z.number().int().min(15).max(1440),
          priceAmount: z.number().int().min(1),
          currency: z.string().min(3).max(3).optional(),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    const isCombo = (data.kind ?? 'standard') === 'combo';
    if (!isCombo) {
      return;
    }
    const combo = data.comboCategoryIds ?? [];
    if (combo.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comboCategoryIds'],
        message: 'comboCategoryIds must contain at least one item for combo',
      });
    }
  });

export type CreateSpecialistPersonalServiceBody = z.infer<
  typeof createSpecialistPersonalServiceBodySchema
>;
