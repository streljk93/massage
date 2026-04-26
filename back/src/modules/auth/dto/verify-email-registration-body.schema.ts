import { z } from 'zod';

export const verifyEmailRegistrationBodySchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  code: z.string().length(6).regex(/^\d+$/u, 'Code must be 6 digits'),
});

export type VerifyEmailRegistrationBody = z.infer<
  typeof verifyEmailRegistrationBodySchema
>;
