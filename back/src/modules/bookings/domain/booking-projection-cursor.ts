import { computeBookingProjectionHash } from './booking-projection-hash';
import type { BookingRowProjection } from './booking-projection';

/**
 * Периодическая полная сверка `projectionHash` с журналом (без short-circuit по hash).
 * Short-circuit по hash не заменяет источник правды — только ускоряет read-path / подозрение в drift.
 */
export const BOOKING_PROJECTION_FORCE_HASH_VERIFY_EVERY_N_VERSIONS = 31;

export function shouldVerifyProjectionHashAgainstJournal(
  version: number,
  projectionHash: string | null,
): boolean {
  return (
    version > 0 &&
    projectionHash != null &&
    version % BOOKING_PROJECTION_FORCE_HASH_VERIFY_EVERY_N_VERSIONS === 0
  );
}

/**
 * Дешёвый инвариант без полного reduce: хвост `localSequence` = materialized `lastAppliedSequence`.
 */
export function cheapTailSequenceMatchesRow(args: {
  rowLastAppliedSequence: number;
  tailEventLocalSequence: number | null;
}): boolean {
  if (args.tailEventLocalSequence == null) {
    return args.rowLastAppliedSequence === 0;
  }
  return args.tailEventLocalSequence === args.rowLastAppliedSequence;
}

export type ProjectionHashShortCircuitResult =
  | { kind: 'mismatch_or_unknown'; mustFullReplay: true }
  | { kind: 'hash_ok'; projectionHash: string };

/**
 * Только для **read-only** путей (диагностика): если совпало — полный reduce не обязателен для отображения снимка.
 * Append после INSERT всегда делает полный replay.
 */
export function tryProjectionHashShortCircuitReadPath(args: {
  storedHash: string | null;
  projection: BookingRowProjection;
  lastEventId: string;
  lastLocalSequence: number;
}): ProjectionHashShortCircuitResult {
  if (args.storedHash == null) {
    return { kind: 'mismatch_or_unknown', mustFullReplay: true };
  }
  const computed = computeBookingProjectionHash({
    projection: args.projection,
    lastEventId: args.lastEventId,
    localSequence: args.lastLocalSequence,
  });
  if (args.storedHash === computed) {
    return {
      kind: 'hash_ok',
      projectionHash: computed,
    };
  }
  return { kind: 'mismatch_or_unknown', mustFullReplay: true };
}
