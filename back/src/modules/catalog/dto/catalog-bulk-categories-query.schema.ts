import { z } from 'zod';

const pathSlug = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'major slug must be lowercase letters, digits, hyphens',
  );

const majorSlugsFromCommaList = z
  .string()
  .min(1)
  .max(800)
  .transform((raw) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return [...new Set(parts)];
  })
  .pipe(z.array(pathSlug).min(1).max(10));

/**
 * Булево из query string. Не использовать `z.coerce.boolean()`: строка `"false"` из URL
 * даёт `true` (непустая строка → truthy), из‑за чего ошибочно включался фильтр витрины.
 */
const listedInDirectoryFromQuery = z.preprocess((raw: unknown): boolean => {
  if (raw === undefined || raw === null || raw === '') {
    return false;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  const s = String(raw).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no') {
    return false;
  }
  if (s === 'true' || s === '1' || s === 'yes') {
    return true;
  }
  return false;
}, z.boolean());

/** Query: `majorSlugs=massage,nail`, опционально `listedInDirectory=true`. */
export const catalogBulkCategoriesQuerySchema = z.object({
  majorSlugs: majorSlugsFromCommaList,
  listedInDirectory: listedInDirectoryFromQuery,
});

export type CatalogBulkCategoriesQuery = z.infer<
  typeof catalogBulkCategoriesQuerySchema
>;
