import type { Prisma } from '@prisma/client';

export type ListingSlotGroupSeed = {
  dayKey: 'today' | 'tomorrow';
  times: string[];
};

/**
 * Разбор JSON из `listingSlotGroups` (Prisma Json) в сид для карточек.
 */
export function parseListingSlotGroups(
  raw: Prisma.JsonValue | null | undefined,
): ListingSlotGroupSeed[] {
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  const out: ListingSlotGroupSeed[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const dayKey = (item as { dayKey?: unknown }).dayKey;
    const times = (item as { times?: unknown }).times;
    if (dayKey !== 'today' && dayKey !== 'tomorrow') {
      continue;
    }
    if (!Array.isArray(times)) {
      continue;
    }
    out.push({
      dayKey,
      times: times.filter((t): t is string => typeof t === 'string'),
    });
  }
  return out;
}
