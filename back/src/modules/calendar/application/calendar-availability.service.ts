import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AvailabilityOverrideType,
  AvailabilityRuleType,
  type Prisma,
} from '@prisma/client';
import {
  CalendarTxLocks,
  normalizeCalendarResourceIdsForLock,
} from '../domain/calendar-tx-locks';
import {
  localIntervalBoundsInTimeZone,
} from '../domain/calendar-timezone';
import {
  CalendarRepository,
  type CalendarResourceRow,
} from '../infrastructure/calendar.repository';

@Injectable()
export class CalendarAvailabilityService {
  constructor(private readonly calendarRepository: CalendarRepository) {}

  async assertSlotAvailableForResourcesTx(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      resourceIds: string[];
      startsAt: Date;
      endsAt: Date;
      requireWorkingAvailability: boolean;
      excludeEventId?: string | null;
    },
  ): Promise<CalendarResourceRow[]> {
    const resourceIds = normalizeCalendarResourceIdsForLock(args.resourceIds);
    if (resourceIds.length === 0) {
      throw new BadRequestException({
        code: 'CALENDAR_RESOURCE_REQUIRED',
        message: 'At least one calendar resource is required',
      });
    }
    if (args.endsAt.getTime() <= args.startsAt.getTime()) {
      throw new BadRequestException({
        code: 'CALENDAR_INVALID_INTERVAL',
        message: 'Calendar event end must be after start',
      });
    }

    for (const resourceId of resourceIds) {
      await CalendarTxLocks.acquireResourceSlotExclusion(tx, resourceId);
    }

    const resources = await this.calendarRepository.findResourcesByIdsTx(
      tx,
      resourceIds,
    );
    if (resources.length !== resourceIds.length) {
      throw new BadRequestException({
        code: 'CALENDAR_RESOURCE_NOT_FOUND',
        message: 'One or more calendar resources were not found',
      });
    }
    for (const r of resources) {
      if (r.organizationId !== args.organizationId) {
        throw new BadRequestException({
          code: 'CALENDAR_RESOURCE_ORGANIZATION_MISMATCH',
          message: 'Calendar resource belongs to another organization',
        });
      }
      if (!r.isActive || r.deletedAt != null) {
        throw new BadRequestException({
          code: 'CALENDAR_RESOURCE_INACTIVE',
          message: 'Inactive calendar resources cannot receive new events',
        });
      }
      if (r.capacity < 1) {
        throw new BadRequestException({
          code: 'CALENDAR_RESOURCE_INVALID_CAPACITY',
          message: 'Calendar resource capacity must be positive',
        });
      }
    }

    if (args.requireWorkingAvailability) {
      await this.assertPassesAvailabilityRulesTx(tx, {
        resources,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
      });
    }

    const overlapCounts =
      await this.calendarRepository.countBlockingOverlapsByResourceTx(tx, {
        resourceIds,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        excludeEventId: args.excludeEventId,
      });
    for (const r of resources) {
      const count = overlapCounts.get(r.id) ?? 0;
      if (count >= r.capacity) {
        throw new BadRequestException({
          code: 'CALENDAR_RESOURCE_BUSY',
          message: 'Calendar resource is busy during this interval',
        });
      }
    }

    return resources;
  }

  private async assertPassesAvailabilityRulesTx(
    tx: Prisma.TransactionClient,
    args: {
      resources: CalendarResourceRow[];
      startsAt: Date;
      endsAt: Date;
    },
  ): Promise<void> {
    const first = args.resources[0];
    if (first == null) {
      return;
    }
    const timeZone = first.organization.timeZone;
    const localBounds = localIntervalBoundsInTimeZone(
      args.startsAt,
      args.endsAt,
      timeZone,
    );
    if (localBounds == null) {
      throw new BadRequestException({
        code: 'CALENDAR_OUTSIDE_WORKING_HOURS',
        message: 'Calendar events must fit within one organization-local day',
      });
    }

    const { weekday, date, startMinute, endMinute } = localBounds;
    const resourceIds = args.resources.map((r) => r.id);

    const [rules, overrides] = await Promise.all([
      this.calendarRepository.findAvailabilityRulesTx(tx, {
        resourceIds,
        weekday,
      }),
      this.calendarRepository.findAvailabilityOverridesTx(tx, {
        resourceIds,
        date,
      }),
    ]);

    for (const resource of args.resources) {
      const resourceOverrides = overrides.filter(
        (o) => o.resourceId === resource.id,
      );
      const off = resourceOverrides.find(
        (o) =>
          o.type === AvailabilityOverrideType.off &&
          this.overrideOverlaps(o.startsAt, o.endsAt, args.startsAt, args.endsAt),
      );
      if (off != null) {
        throw new BadRequestException({
          code: 'CALENDAR_AVAILABILITY_OFF',
          message: 'Calendar resource is marked off during this interval',
        });
      }

      const extra = resourceOverrides.find(
        (o) =>
          o.type === AvailabilityOverrideType.extra &&
          this.overrideCovers(o.startsAt, o.endsAt, args.startsAt, args.endsAt),
      );
      if (extra != null) {
        continue;
      }

      const workingRule = rules.find(
        (r) =>
          r.resourceId === resource.id &&
          r.type === AvailabilityRuleType.working &&
          r.startMinute <= startMinute &&
          r.endMinute >= endMinute,
      );
      if (workingRule == null) {
        throw new BadRequestException({
          code: 'CALENDAR_OUTSIDE_WORKING_HOURS',
          message: 'Calendar event is outside resource working hours',
        });
      }

      const regularBreak = rules.find(
        (r) =>
          r.resourceId === resource.id &&
          r.type === AvailabilityRuleType.break &&
          r.startMinute < endMinute &&
          r.endMinute > startMinute,
      );
      if (regularBreak != null) {
        throw new BadRequestException({
          code: 'CALENDAR_AVAILABILITY_BREAK',
          message: 'Calendar resource has a regular break during this interval',
        });
      }
    }
  }

  private overrideOverlaps(
    overrideStart: Date | null,
    overrideEnd: Date | null,
    startsAt: Date,
    endsAt: Date,
  ): boolean {
    if (overrideStart == null || overrideEnd == null) {
      return true;
    }
    return overrideStart.getTime() < endsAt.getTime() &&
      overrideEnd.getTime() > startsAt.getTime();
  }

  private overrideCovers(
    overrideStart: Date | null,
    overrideEnd: Date | null,
    startsAt: Date,
    endsAt: Date,
  ): boolean {
    if (overrideStart == null || overrideEnd == null) {
      return true;
    }
    return overrideStart.getTime() <= startsAt.getTime() &&
      overrideEnd.getTime() >= endsAt.getTime();
  }
}
