import { z } from 'zod';

export const oauthLoginBodySchema = z.object({
  provider: z.literal('google'),
  idToken: z.string().min(1).max(20_000),
  locale: z.enum(['en', 'ru', 'vi']).optional(),
});

export type OauthLoginBody = z.infer<typeof oauthLoginBodySchema>;
