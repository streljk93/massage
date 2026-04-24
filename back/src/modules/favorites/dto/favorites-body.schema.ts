import { z } from 'zod';

export const favoriteTargetKindSchema = z.enum(['organization', 'specialist']);

export type FavoriteTargetKindDto = z.infer<typeof favoriteTargetKindSchema>;

export const addFavoriteBodySchema = z.object({
  targetKind: favoriteTargetKindSchema,
  targetId: z.string().uuid(),
});

export type AddFavoriteBody = z.infer<typeof addFavoriteBodySchema>;

export const mergeFavoritesBodySchema = z.object({
  items: z
    .array(
      z.object({
        targetKind: favoriteTargetKindSchema,
        targetId: z.string().uuid(),
      }),
    )
    .max(500),
});

export type MergeFavoritesBody = z.infer<typeof mergeFavoritesBodySchema>;
