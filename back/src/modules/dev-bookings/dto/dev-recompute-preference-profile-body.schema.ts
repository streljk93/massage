import { z } from 'zod';

const apiLocaleEnum = z.enum(['en', 'vi', 'ru']);

export const devRecomputePreferenceProfileBodySchema = z.object({
  email: z.string().email(),
  /** Для проверки выдачи каталога (блок на главной). */
  locale: apiLocaleEnum.optional(),
});

export type DevRecomputePreferenceProfileBody = z.infer<
  typeof devRecomputePreferenceProfileBodySchema
>;
