import type { BookingStatus } from '@prisma/client';

import {
  BOOKING_STATUS_TRANSITION_MAP,
  isBookingStatusTransitionAllowed,
} from './booking-status-transitions';

/**
 * Кратчайший путь по допустимой матрице переходов (BFS).
 * Для узлов без исходящих рёбер путь может не найтись → `null`.
 */
export function shortestBookingStatusTransitionPath(
  from: BookingStatus,
  to: BookingStatus,
): BookingStatus[] | null {
  if (from === to) {
    return [from];
  }
  /** Не использовать spread на readonly tuple — мутации на копии. */
  type Node = BookingStatus;
  const parents = new Map<Node, Node | undefined>();
  const queue: BookingStatus[] = [from];
  parents.set(from, undefined);

  outer: while (queue.length > 0) {
    const cur = queue.shift()!;
    const targetsRaw = BOOKING_STATUS_TRANSITION_MAP[cur];
    let targets = [...targetsRaw];

    /** Системное исключение домена — как в матрице (см. `isBookingStatusTransitionAllowed`). */
    if (cur === 'in_progress') {
      targets.push('canceled_by_master');
    }

    targets = [...new Set(targets)];

    for (const nxt of targets) {
      if (!parents.has(nxt)) {
        parents.set(nxt, cur);
        queue.push(nxt as BookingStatus);
        if (nxt === to) {
          break outer;
        }
      }
    }
  }

  if (!parents.has(to)) {
    /** Попытаться учесть «широкий» API `isBookingStatusTransitionAllowed`. */
    if (!isBookingStatusTransitionAllowed(from, to)) {
      return null;
    }
    return [from, to];
  }

  const out: BookingStatus[] = [];
  let at: BookingStatus | undefined = to;
  while (at !== undefined) {
    out.push(at);
    at = parents.get(at);
  }
  out.reverse();

  /** Провалидировать склейку локально (страховка). */
  for (let i = 0; i < out.length - 1; i++) {
    if (!isBookingStatusTransitionAllowed(out[i]!, out[i + 1]!)) {
      /** Допускаем only known exception handled above insertion not in reconstructed path reliably */
      const a = out[i]!;
      const b = out[i + 1]!;
      if (!(a === 'in_progress' && b === 'canceled_by_master')) {
        return null;
      }
    }
  }

  return out;
}
