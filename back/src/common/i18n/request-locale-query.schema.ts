import { z } from 'zod';
import { SUPPORTED_API_LOCALES } from './api-locale';

/** Поле `locale` в query (для merge с другими Zod-схемами ручек). */
export const requestLocaleQueryFieldSchema = z.enum(SUPPORTED_API_LOCALES);

export const requestLocaleQuerySchema = z.object({
  locale: requestLocaleQueryFieldSchema.optional(),
});

export type RequestLocaleQuery = z.infer<typeof requestLocaleQuerySchema>;
