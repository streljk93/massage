import { z } from 'zod';

const avatarUrlStored = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (s) =>
      s.startsWith('/v1/files/public/') ||
      s.startsWith('http://') ||
      s.startsWith('https://'),
    { message: 'Invalid avatar URL' },
  );

export const patchMeBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z.union([avatarUrlStored, z.null()]).optional(),
});

export type PatchMeBody = z.infer<typeof patchMeBodySchema>;
