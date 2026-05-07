import { z } from 'zod';

/** Состояние первичного онбординга до привязки к месту работы. */
export const patchSpecialistOnboardingPreferencesBodySchema = z
  .object({
    workPattern: z.enum(['solo', 'business', 'employed_salon']).optional(),
    majorCategorySlugs: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(20)
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.workPattern == null && data.majorCategorySlugs == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide workPattern and/or majorCategorySlugs',
      });
    }
  });

export type PatchSpecialistOnboardingPreferencesBody = z.infer<
  typeof patchSpecialistOnboardingPreferencesBodySchema
>;
