import { z } from 'zod';

export const resendEmailVerificationBodySchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  password: z.string().min(1).max(256),
});

export type ResendEmailVerificationBody = z.infer<
  typeof resendEmailVerificationBodySchema
>;
