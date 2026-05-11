import { CalendarEventStatus, CalendarResourceType } from '@prisma/client';
import { DirectoryRepository } from './directory.repository';

describe('DirectoryRepository listing occupancy', () => {
  it('reads occupied preview slots from blocking CalendarEvent resources', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        resource: { specialistId: 'specialist-a' },
        event: {
          startsAt: new Date('2026-05-10T10:00:00.000Z'),
          endsAt: new Date('2026-05-10T11:00:00.000Z'),
        },
      },
      {
        resource: { specialistId: null },
        event: {
          startsAt: new Date('2026-05-10T12:00:00.000Z'),
          endsAt: new Date('2026-05-10T13:00:00.000Z'),
        },
      },
    ]);
    const repository = new DirectoryRepository({
      calendarEventResource: { findMany },
    } as never);

    const rows = await repository.findBlockingCalendarEventsForListingOccupancy(
      ['specialist-a'],
      new Date('2026-05-10T00:00:00.000Z'),
      24 * 60 * 60 * 1000,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resource: expect.objectContaining({
            specialistId: { in: ['specialist-a'] },
            type: CalendarResourceType.specialist,
            deletedAt: null,
          }),
          event: expect.objectContaining({
            deletedAt: null,
            status: {
              in: [
                CalendarEventStatus.pending,
                CalendarEventStatus.confirmed,
                CalendarEventStatus.in_progress,
              ],
            },
          }),
        }),
      }),
    );
    expect(rows).toEqual([
      {
        specialistId: 'specialist-a',
        startsAt: new Date('2026-05-10T10:00:00.000Z'),
        endsAt: new Date('2026-05-10T11:00:00.000Z'),
      },
    ]);
  });
});
