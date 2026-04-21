import { z } from 'zod';

/** Query `?placement=` — слот показа баннеров (главная, поиск, …). */
export const advertPlacementQuerySchema = z.object({
  placement: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
      'placement must be a non-empty slug (a-z0-9, segments separated by _ or -)',
    ),
});

export type AdvertPlacementQuery = z.infer<typeof advertPlacementQuerySchema>;
