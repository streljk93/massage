import { z } from 'zod';

/** Состояние первичного онбординга до привязки к месту работы. */
export const patchSpecialistOnboardingPreferencesBodySchema = z
  .object({
    workPattern: z.enum(['solo', 'business', 'employed_salon']).optional(),
    majorCategorySlugs: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(20)
      .optional(),
    /**
     * Подкатегории каталога как «навыки» (без цены/времени); хранятся в `SpecialistSkill`.
     */
    serviceCategoryIds: z.array(z.string().uuid()).max(80).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.workPattern == null &&
      data.majorCategorySlugs == null &&
      data.serviceCategoryIds == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide workPattern, majorCategorySlugs and/or serviceCategoryIds',
      });
    }
  });

export type PatchSpecialistOnboardingPreferencesBody = z.infer<
  typeof patchSpecialistOnboardingPreferencesBodySchema
>;
