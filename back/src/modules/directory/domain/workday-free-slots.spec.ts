import { AvailabilityRuleType } from '@prisma/client';
import { vnWallClockToUtcDate } from '../../../common/datetime/vn-listing-datetime';
import { computeAvailableListingSlotKeysPerSpecialist } from './workday-free-slots';

describe('computeAvailableListingSlotKeysPerSpecialist', () => {
  it('returns only slots allowed by calendar working rules and breaks', () => {
    const available = computeAvailableListingSlotKeysPerSpecialist({
      resources: [
        {
          specialistId: 'specialist-a',
          resourceId: 'resource-a',
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      ],
      rules: [
        {
          resourceId: 'resource-a',
          weekday: 0,
          startMinute: 10 * 60,
          endMinute: 11 * 60,
          type: AvailabilityRuleType.working,
        },
        {
          resourceId: 'resource-a',
          weekday: 0,
          startMinute: 10 * 60 + 30,
          endMinute: 11 * 60,
          type: AvailabilityRuleType.break,
        },
      ],
      overrides: [],
      occupiedBySpecialist: new Map(),
      now: vnWallClockToUtcDate(2026, 5, 10, 8, 0),
      calendarDays: 1,
    });

    expect([...(available.get('specialist-a') ?? [])].sort()).toEqual([
      '2026-05-10|10:00',
    ]);
  });
});
