import { z } from 'zod';

export const registerPushTokenBodySchema = z.object({
  token: z.string().min(1),
  userAgent: z.string().optional(),
});

export type RegisterPushTokenBody = z.infer<typeof registerPushTokenBodySchema>;

export const revokePushTokenBodySchema = z.object({
  token: z.string().min(1),
});

export type RevokePushTokenBody = z.infer<typeof revokePushTokenBodySchema>;
