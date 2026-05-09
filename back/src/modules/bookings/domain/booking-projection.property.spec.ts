import fc from 'fast-check';

import { projectBookingRowFromTimeline } from './booking-projection';

/**
 * Property-слой к плану v13/v14: проекция детерминирована и монотонна по простым цепочкам.
 * Интеграционные гонки — `test/booking-advisory-lock.integration.spec.ts`;
 * дополнительно — async-property с цепочкой микрозадач (прокси недетерминизма планировщика).
 */
describe('projectBookingRowFromTimeline (property)', () => {
  it('created then confirmed always yields confirmed with same slot', () => {
    fc.assert(
      fc.property(
        fc.integer({
          min: Date.parse('2020-01-01T00:00:00.000Z'),
          max: Date.parse('2035-12-31T23:59:59.999Z'),
        }),
        fc.integer({ min: 15, max: 180 }),
        (startMs, durationMinutes) => {
          const start = new Date(startMs);
          const end = new Date(start.getTime() + durationMinutes * 60_000);
          const row = projectBookingRowFromTimeline([
            {
              type: 'created',
              payload: {
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
              },
            },
            { type: 'confirmed', payload: {} },
          ]);
          expect(row.status).toBe('confirmed');
          expect(row.startsAt.getTime()).toBe(start.getTime());
          expect(row.endsAt.getTime()).toBe(end.getTime());
        },
      ),
      { numRuns: 40 },
    );
  });

  it('wrong journal order does not reach confirmed (localSequence discipline)', () => {
    fc.assert(
      fc.property(
        fc.integer({
          min: Date.parse('2020-01-01T00:00:00.000Z'),
          max: Date.parse('2035-12-31T23:59:59.999Z'),
        }),
        fc.integer({ min: 15, max: 120 }),
        (startMs, durationMinutes) => {
          const start = new Date(startMs);
          const end = new Date(start.getTime() + durationMinutes * 60_000);
          const created = {
            type: 'created' as const,
            payload: {
              startsAt: start.toISOString(),
              endsAt: end.toISOString(),
            },
          };
          const confirmed = { type: 'confirmed' as const, payload: {} };
          const valid = projectBookingRowFromTimeline([created, confirmed]);
          const wrongOrder = projectBookingRowFromTimeline([
            confirmed,
            created,
          ]);
          expect(valid.status).toBe('confirmed');
          expect(wrongOrder.status).toBe('pending');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('async chain: несколько микрозадач перед reduce не меняют результат', async () => {
    await fc.assert(
      fc.asyncProperty(fc.nat({ max: 12 }), async (tickCount) => {
        for (let i = 0; i <= tickCount; i++) {
          await Promise.resolve();
        }
        const t0 = new Date('2026-03-10T09:00:00.000Z');
        const t1 = new Date('2026-03-10T10:00:00.000Z');
        const row = projectBookingRowFromTimeline([
          {
            type: 'created',
            payload: {
              startsAt: t0.toISOString(),
              endsAt: t1.toISOString(),
            },
          },
          { type: 'confirmed', payload: {} },
        ]);
        expect(row.status).toBe('confirmed');
        expect(row.startsAt.getTime()).toBe(t0.getTime());
      }),
      { numRuns: 12 },
    );
  });
});
