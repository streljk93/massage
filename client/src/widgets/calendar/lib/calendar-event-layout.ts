import type { CalendarEvent } from "../model/types";

/** Пересечение по времени (интервалы ISO UTC в одной колонке дня). */
export function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Группы событий с транзитивным пересечением по времени (компоненты графа «пересекается с»).
 * Внутри каждой группы события раскладываются по дорожкам (`assignLaneLayout`), без объединения в одну карточку.
 */
export function clusterOverlappingEvents(events: CalendarEvent[]): CalendarEvent[][] {
  const list = [...events];
  const n = list.length;
  if (n === 0) return [];
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]);
    }
    return parent[i];
  }

  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) {
      parent[ri] = rj;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (eventsOverlap(list[i], list[j])) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, CalendarEvent[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r) ?? [];
    g.push(list[i]);
    groups.set(r, g);
  }

  return [...groups.values()];
}

export type LaneAssignment = { lane: number; laneCount: number; span: number };

/**
 * Внутри группы пересечений — назначение дорожек (колонок), чтобы события не наезжали друг на друга по ширине.
 * События в одной дорожке идут по времени без пересечений (greedy по ISO endsAt / startsAt).
 */
export function assignLaneLayout(events: CalendarEvent[]): Map<string, LaneAssignment> {
  if (events.length === 0) {
    return new Map();
  }
  const sorted = [...events].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
  );
  const laneEnds: string[] = [];
  const lanes: CalendarEvent[][] = [];
  const byId = new Map<string, LaneAssignment>();
  for (const ev of sorted) {
    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i]! <= ev.startsAt) {
        lane = i;
        break;
      }
    }
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(ev.endsAt);
      lanes.push([ev]);
    } else {
      laneEnds[lane] = ev.endsAt;
      lanes[lane]!.push(ev);
    }
    byId.set(ev.id, { lane, laneCount: 0, span: 1 });
  }

  const laneCount = laneEnds.length;

  function overlapsLane(ev: CalendarEvent, laneIdx: number): boolean {
    const laneEvents = lanes[laneIdx] ?? [];
    for (const other of laneEvents) {
      if (other.id !== ev.id && eventsOverlap(ev, other)) {
        return true;
      }
    }
    return false;
  }

  for (const ev of sorted) {
    const meta = byId.get(ev.id);
    if (!meta) continue;
    meta.laneCount = laneCount;
    let span = 1;
    for (let laneIdx = meta.lane + 1; laneIdx < laneCount; laneIdx++) {
      if (overlapsLane(ev, laneIdx)) {
        break;
      }
      span += 1;
    }
    meta.span = span;
  }

  return byId;
}

export type EventTone = { bg: string; border: string; text: string; dot: string };

export function resolveEventTone(event: CalendarEvent): EventTone {
  /** На бэке `done` / no-show проецируются в `CalendarEventStatus.cancelled` — не смешивать с отменой записи. */
  const bookingStatus = event.type === "booking" ? event.booking?.status : null;
  const doneTone: EventTone = {
    bg: "bg-muted/30",
    border: "border-l-muted-foreground/40",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  };
  if (bookingStatus === "done") {
    return doneTone;
  }
  if (event.status === "cancelled")
    return {
      bg: "bg-muted/40",
      border: "border-l-muted-foreground/30",
      text: "text-muted-foreground/60 line-through",
      dot: "bg-muted-foreground/40",
    };
  if (event.type === "block")
    return {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-l-amber-400",
      text: "text-amber-800 dark:text-amber-200",
      dot: "bg-amber-400",
    };
  const tones: Record<string, EventTone> = {
    pending: {
      bg: "bg-sky-50 dark:bg-sky-950/20",
      border: "border-l-sky-400",
      text: "text-sky-900 dark:text-sky-100",
      dot: "bg-sky-400",
    },
    confirmed: {
      bg: "bg-violet-50 dark:bg-violet-950/20",
      border: "border-l-violet-500",
      text: "text-violet-900 dark:text-violet-100",
      dot: "bg-violet-500",
    },
    in_progress: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-l-emerald-500",
      text: "text-emerald-900 dark:text-emerald-100",
      dot: "bg-emerald-500",
    },
    done: doneTone,
  };
  return (
    tones[event.status ?? ""] ?? {
      bg: "bg-card",
      border: "border-l-primary/40",
      text: "text-foreground",
      dot: "bg-primary/40",
    }
  );
}
