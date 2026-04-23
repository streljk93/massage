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

/**
 * Для карточки **организации**: оставляем время, если оно не занято хотя бы у одного мастера из списка.
 * Раньше использовался union занятых по всем мастерам — слот пропадал при брони одного специалиста,
 * хотя другие в салоне в это время свободны.
 */
export function filterOrgSlotGroupsByOccupiedKeys(
  slotGroups: ListingSlotGroupSeed[],
  listedSpecialistIds: string[],
  occupiedBySpecialist: Map<string, Set<string>>,
): ListingSlotGroupSeed[] {
  if (listedSpecialistIds.length === 0 || slotGroups.length === 0) {
    return slotGroups;
  }

  const out: ListingSlotGroupSeed[] = [];
  for (const g of slotGroups) {
    const times = g.times.filter((t) => {
      const label = normalizeListingSlotTimeLabel(t);
      const key = `${g.calendarDate}|${label}`;
      return listedSpecialistIds.some((id) => {
        const occ = occupiedBySpecialist.get(id);
        return !(occ?.has(key) ?? false);
      });
    });
    if (times.length > 0) {
      out.push({ calendarDate: g.calendarDate, times });
    }
  }
  return out;
}
