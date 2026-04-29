import { z } from 'zod';

export const reorderGalleryItemsBodySchema = z
  .object({
    orderedItemIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

export type ReorderGalleryItemsBody = z.infer<
  typeof reorderGalleryItemsBodySchema
>;
