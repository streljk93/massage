import { CalendarAvailabilityService } from './calendar-availability.service';
import type { CalendarResourceRow } from '../infrastructure/calendar.repository';

function makeTx() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
  } as never;
}

function makeResource(overrides?: Partial<CalendarResourceRow>): CalendarResourceRow {
  return {
    id: 'resource-a',
    organizationId: 'organization-a',
    type: 'specialist',
    specialistId: 'specialist-a',
    name: 'Specialist A',
    capacity: 1,
    isActive: true,
    deletedAt: null,
    organization: {
      id: 'organization-a',
      name: 'Organization A',
      timeZone: 'Asia/Ho_Chi_Minh',
      listingWorkdayStartMinute: 0,
      listingWorkdayEndMinute: 1440,
    },
    ...overrides,
  };
}

describe('CalendarAvailabilityService', () => {
  it('rejects a slot when a blocking calendar event already occupies resource capacity', async () => {
    const repository = {
      findResourcesByIdsTx: jest.fn().mockResolvedValue([makeResource()]),
      countBlockingOverlapsByResourceTx: jest
        .fn()
        .mockResolvedValue(new Map([['resource-a', 1]])),
    };
    const service = new CalendarAvailabilityService(repository as never);

    await expect(
      service.assertSlotAvailableForResourcesTx(makeTx(), {
        organizationId: 'organization-a',
        resourceIds: ['resource-a'],
        startsAt: new Date('2026-05-10T10:00:00.000Z'),
        endsAt: new Date('2026-05-10T11:00:00.000Z'),
        requireWorkingAvailability: false,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CALENDAR_RESOURCE_BUSY' }),
    });
  });

  it('allows a slot while blocking overlaps remain below resource capacity', async () => {
    const resource = makeResource({ capacity: 2 });
    const repository = {
      findResourcesByIdsTx: jest.fn().mockResolvedValue([resource]),
      countBlockingOverlapsByResourceTx: jest
        .fn()
        .mockResolvedValue(new Map([['resource-a', 1]])),
    };
    const service = new CalendarAvailabilityService(repository as never);

    await expect(
      service.assertSlotAvailableForResourcesTx(makeTx(), {
        organizationId: 'organization-a',
        resourceIds: ['resource-a'],
        startsAt: new Date('2026-05-10T10:00:00.000Z'),
        endsAt: new Date('2026-05-10T11:00:00.000Z'),
        requireWorkingAvailability: false,
      }),
    ).resolves.toEqual([resource]);
  });

  it('treats next local midnight as 24:00 of the start day for working availability', async () => {
    const resource = makeResource();
    const repository = {
      findResourcesByIdsTx: jest.fn().mockResolvedValue([resource]),
      findAvailabilityRulesTx: jest.fn().mockResolvedValue([
        {
          resourceId: 'resource-a',
          type: 'working',
          startMinute: 0,
          endMinute: 24 * 60,
        },
      ]),
      findAvailabilityOverridesTx: jest.fn().mockResolvedValue([]),
      countBlockingOverlapsByResourceTx: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new CalendarAvailabilityService(repository as never);

    await expect(
      service.assertSlotAvailableForResourcesTx(makeTx(), {
        organizationId: 'organization-a',
        resourceIds: ['resource-a'],
        startsAt: new Date('2026-05-10T16:00:00.000Z'), // 23:00 Asia/Ho_Chi_Minh
        endsAt: new Date('2026-05-10T17:00:00.000Z'), // 00:00 next local day
        requireWorkingAvailability: true,
      }),
    ).resolves.toEqual([resource]);
    expect(repository.findAvailabilityRulesTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ weekday: 0 }),
    );
  });
});
