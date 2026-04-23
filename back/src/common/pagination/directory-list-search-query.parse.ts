import { BadRequestException } from '@nestjs/common';

const MAX_SEARCH_Q_LEN = 200;
const MAX_CATEGORY_SLUGS = 24;
/** Латиница, цифры, дефис (slug подкатегории или большой категории). */
const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Опционально: ограничить список вертикалью (`MajorServiceCategory.slug`). */
export function parseOptionalMajorCategorySlug(raw?: string): string | null {
  const t = raw?.trim().toLowerCase();
  if (!t) {
    return null;
  }
  if (!CATEGORY_SLUG_RE.test(t)) {
    throw new BadRequestException({
      code: 'INVALID_MAJOR_CATEGORY_SLUG',
      message: 'Invalid majorSlug',
    });
  }
  return t;
}

export function parseListSearchQ(raw?: string): string | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  return t.slice(0, MAX_SEARCH_Q_LEN);
}

export function parseListCategorySlugsCsv(raw?: string): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const parts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) {
      continue;
    }
    if (!CATEGORY_SLUG_RE.test(p)) {
      throw new BadRequestException({
        code: 'INVALID_CATEGORY_SLUG',
        message: 'Invalid category slug in categories parameter',
      });
    }
    seen.add(p);
    out.push(p);
    if (out.length >= MAX_CATEGORY_SLUGS) {
      break;
    }
  }
  return out;
}

function parseOptionalNonNegInt(raw?: string): number | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException({
      code: 'INVALID_PRICE_VND',
      message: 'priceMinVnd and priceMaxVnd must be non-negative integers',
    });
  }
  return n;
}

export function parseOptionalVndPriceRange(minRaw?: string, maxRaw?: string): {
  priceMinVnd: number | null;
  priceMaxVnd: number | null;
} {
  const priceMinVnd = parseOptionalNonNegInt(minRaw);
  const priceMaxVnd = parseOptionalNonNegInt(maxRaw);
  if (
    priceMinVnd != null &&
    priceMaxVnd != null &&
    priceMinVnd > priceMaxVnd
  ) {
    return { priceMinVnd: priceMaxVnd, priceMaxVnd: priceMinVnd };
  }
  return { priceMinVnd, priceMaxVnd };
}
