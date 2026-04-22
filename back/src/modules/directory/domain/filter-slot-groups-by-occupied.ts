import {
  normalizeListingSlotTimeLabel,
  type ListingSlotGroupSeed,
} from './listing-slot-groups';

/**
 * Убирает из витринных групп слотов времена, для которых уже есть активное бронирование
 * (совпадение по дате в таймзоне витрины + `HH:mm`).
 */
export function filterSlotGroupsByOccupiedKeys(
  slotGroups: ListingSlotGroupSeed[],
  occupiedKeys: Set<string>,
): ListingSlotGroupSeed[] {
  if (occupiedKeys.size === 0) {
    return slotGroups;
  }

  const out: ListingSlotGroupSeed[] = [];
  for (const g of slotGroups) {
    const times = g.times.filter((t) => {
      const label = normalizeListingSlotTimeLabel(t);
      return !occupiedKeys.has(`${g.calendarDate}|${label}`);
    });
    if (times.length > 0) {
      out.push({ calendarDate: g.calendarDate, times });
    }
  }
  return out;
}
