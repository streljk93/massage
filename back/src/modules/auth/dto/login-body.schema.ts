import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  password: z.string().min(1).max(256),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
