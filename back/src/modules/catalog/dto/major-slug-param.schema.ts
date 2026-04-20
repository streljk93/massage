import { z } from 'zod';

/** Параметр пути `:majorSlug` — латиница, цифры и дефисы (как slug в сиде). */
export const majorSlugParamSchema = z.object({
  majorSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'majorSlug must be a slug (lowercase letters, digits, hyphens)',
    ),
});

export type MajorSlugParam = z.infer<typeof majorSlugParamSchema>;
