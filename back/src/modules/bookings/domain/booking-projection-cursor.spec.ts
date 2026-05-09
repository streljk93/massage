import {
  cheapTailSequenceMatchesRow,
  shouldVerifyProjectionHashAgainstJournal,
  tryProjectionHashShortCircuitReadPath,
} from './booking-projection-cursor';
import { computeBookingProjectionHash } from './booking-projection-hash';
import { projectBookingRowFromTimeline } from './booking-projection';

describe('booking-projection-cursor', () => {
  it('shouldVerifyProjectionHashAgainstJournal every N versions', () => {
    expect(shouldVerifyProjectionHashAgainstJournal(31, 'h')).toBe(true);
    expect(shouldVerifyProjectionHashAgainstJournal(30, 'h')).toBe(false);
    expect(shouldVerifyProjectionHashAgainstJournal(31, null)).toBe(false);
  });

  it('cheapTailSequenceMatchesRow', () => {
    expect(
      cheapTailSequenceMatchesRow({
        rowLastAppliedSequence: 3,
        tailEventLocalSequence: 3,
      }),
    ).toBe(true);
    expect(
      cheapTailSequenceMatchesRow({
        rowLastAppliedSequence: 0,
        tailEventLocalSequence: null,
      }),
    ).toBe(true);
    expect(
      cheapTailSequenceMatchesRow({
        rowLastAppliedSequence: 1,
        tailEventLocalSequence: null,
      }),
    ).toBe(false);
    expect(
      cheapTailSequenceMatchesRow({
        rowLastAppliedSequence: 1,
        tailEventLocalSequence: 3,
      }),
    ).toBe(false);
  });

  it('tryProjectionHashShortCircuitReadPath accepts matching hash', () => {
    const t1 = new Date('2026-01-01T10:00:00.000Z');
    const t2 = new Date('2026-01-01T11:00:00.000Z');
    const projection = projectBookingRowFromTimeline([
      {
        type: 'created',
        payload: { startsAt: t1.toISOString(), endsAt: t2.toISOString() },
      },
    ]);
    const stored = computeBookingProjectionHash({
      projection,
      lastEventId: 'e1',
      localSequence: 1,
    });
    const r = tryProjectionHashShortCircuitReadPath({
      storedHash: stored,
      projection,
      lastEventId: 'e1',
      lastLocalSequence: 1,
    });
    expect(r.kind).toBe('hash_ok');
  });
});
