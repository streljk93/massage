import { normalizeCalendarResourceIdsForLock } from './calendar-tx-locks';

describe('calendar tx lock ordering', () => {
  it('deduplicates and sorts resource ids before locking', () => {
    expect(
      normalizeCalendarResourceIdsForLock(['resource-c', 'resource-a', 'resource-c', 'resource-b']),
    ).toEqual(['resource-a', 'resource-b', 'resource-c']);
  });
});
