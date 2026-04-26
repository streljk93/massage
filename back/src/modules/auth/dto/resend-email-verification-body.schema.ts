import { z } from 'zod';
import { SUPPORTED_API_LOCALES } from '../../../common/i18n/api-locale';

export const resendEmailVerificationBodySchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  password: z.string().min(1).max(256),
  /** Язык OTP-письма (до верификации профиль не используем). Без поля — en. */
  locale: z.enum(SUPPORTED_API_LOCALES).optional(),
});

export type ResendEmailVerificationBody = z.infer<
  typeof resendEmailVerificationBodySchema
>;
