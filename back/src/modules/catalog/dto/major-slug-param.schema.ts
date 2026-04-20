import { z } from 'zod';

/** Сегмент slug в пути: латиница, цифры и дефисы (как в сидах каталога). */
const pathSlug = (fieldName: string) =>
  z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      `${fieldName} must be a slug (lowercase letters, digits, hyphens)`,
    );

/** Параметр пути `:majorSlug`. */
export const majorSlugParamSchema = z.object({
  majorSlug: pathSlug('majorSlug'),
});

export type MajorSlugParam = z.infer<typeof majorSlugParamSchema>;

/** Параметры пути `:majorSlug` + `:categorySlug` (одна подкатегория внутри большой). */
export const majorAndCategorySlugParamSchema = z.object({
  majorSlug: pathSlug('majorSlug'),
  categorySlug: pathSlug('categorySlug'),
});

export type MajorAndCategorySlugParam = z.infer<
  typeof majorAndCategorySlugParamSchema
>;
