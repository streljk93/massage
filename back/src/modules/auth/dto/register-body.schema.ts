import { z } from 'zod';
import { SUPPORTED_API_LOCALES } from '../../../common/i18n/api-locale';

export const registerBodySchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(256),
  /**
   * Язык письма с OTP (пользователь ещё не подтвердил email — в профиль не пишется).
   * Без поля — письмо на английском.
   */
  locale: z.enum(SUPPORTED_API_LOCALES).optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
