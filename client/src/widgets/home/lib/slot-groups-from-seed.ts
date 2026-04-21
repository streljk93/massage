import type { AvailabilitySlotGroup } from "@/shared/ui";
import type { SlotGroupSeed } from "./mock-data";

/** Как на странице поиска: namespace `slots`, ключи `today` / `tomorrow`. */
export function slotGroupsFromSeed(
  groups: SlotGroupSeed[] | undefined | null,
  tSlots: (key: string) => string,
): AvailabilitySlotGroup[] {
  const list = groups ?? [];
  return list.map((g) => ({
    dayLabel:
      g.dayKey === "today" ? tSlots("today") : tSlots("tomorrow"),
    times: g.times ?? [],
  }));
}
