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

const appLocale = z.enum(['en', 'vi', 'ru']);

export const patchMeBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z.union([avatarUrlStored, z.null()]).optional(),
  /** Совпадает с локалью в URL клиента (`/[locale]/...`) — для писем и локализованных подписей. */
  locale: appLocale.optional(),
  bookingReminderEnabled: z.boolean().optional(),
  bookingReminderLeadMinutes: z
    .union([z.literal(15), z.literal(30), z.literal(60)])
    .optional(),
});

export type PatchMeBody = z.infer<typeof patchMeBodySchema>;
