import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(256),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
