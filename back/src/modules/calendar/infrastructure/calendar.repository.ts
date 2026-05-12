import { Injectable } from '@nestjs/common';
import {
  AvailabilityRuleType,
  CalendarEventStatus,
  CalendarEventType,
  CalendarResourceType,
  Prisma,
  type CalendarBlockReason,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  CALENDAR_BLOCKING_EVENT_STATUSES,
  CALENDAR_VISIBLE_EVENT_STATUSES,
} from '../domain/calendar-event-status';

export const calendarResourceSelect = {
  id: true,
  organizationId: true,
  type: true,
  specialistId: true,
  name: true,
  capacity: true,
  isActive: true,
  deletedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      timeZone: true,
      listingWorkdayStartMinute: true,
      listingWorkdayEndMinute: true,
    },
  },
} satisfies Prisma.CalendarResourceSelect;

export type CalendarResourceRow = Prisma.CalendarResourceGetPayload<{
  select: typeof calendarResourceSelect;
}>;

export const calendarEventListSelect = {
  id: true,
  organizationId: true,
  bookingId: true,
  startsAt: true,
  endsAt: true,
  type: true,
  status: true,
  blockReason: true,
  notes: true,
  version: true,
  createdByUserId: true,
  createdByUser: {
    select: {
      name: true,
      email: true,
    },
  },
  resources: {
    select: {
      id: true,
      role: true,
      resource: {
        select: {
          id: true,
          type: true,
          name: true,
          specialistId: true,
        },
      },
    },
  },
  booking: {
    select: {
      id: true,
      status: true,
      client: { select: { name: true } },
      specialist: {
        select: {
          id: true,
          listingName: true,
          user: { select: { name: true } },
        },
      },
      categoryShortNameSnapshot: true,
      priceAmountSnapshot: true,
      currencySnapshot: true,
    },
  },
} satisfies Prisma.CalendarEventSelect;

export type CalendarEventListRow = Prisma.CalendarEventGetPayload<{
  select: typeof calendarEventListSelect;
}>;

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSpecialistResourceTx(
    tx: Prisma.TransactionClient,
    args: { organizationId: string; specialistId: string },
  ): Promise<CalendarResourceRow | null> {
    return tx.calendarResource.findFirst({
      where: {
        organizationId: args.organizationId,
        specialistId: args.specialistId,
        type: CalendarResourceType.specialist,
        deletedAt: null,
      },
      select: calendarResourceSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  findSpecialistResourcesTx(
    tx: Prisma.TransactionClient,
    args: { organizationId: string; specialistId: string },
  ): Promise<CalendarResourceRow[]> {
    return tx.calendarResource.findMany({
      where: {
        organizationId: args.organizationId,
        specialistId: args.specialistId,
        type: CalendarResourceType.specialist,
      },
      select: calendarResourceSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async restoreSpecialistResourceTx(
    tx: Prisma.TransactionClient,
    args: { resourceId: string; name: string },
  ): Promise<CalendarResourceRow> {
    const now = new Date();
    const activeRulesCount = await tx.availabilityRule.count({
      where: { resourceId: args.resourceId, deletedAt: null },
    });
    if (activeRulesCount === 0) {
      const latestDeletedRule = await tx.availabilityRule.findFirst({
        where: { resourceId: args.resourceId, deletedAt: { not: null } },
        select: { deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      });
      if (latestDeletedRule?.deletedAt != null) {
        await tx.availabilityRule.updateMany({
          where: {
            resourceId: args.resourceId,
            deletedAt: latestDeletedRule.deletedAt,
          },
          data: { deletedAt: null },
        });
      }
    }
    const activeRules = await tx.availabilityRule.findMany({
      where: { resourceId: args.resourceId, deletedAt: null },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const latestActiveRuleCreatedAt = activeRules[0]?.createdAt;
    if (latestActiveRuleCreatedAt != null) {
      await tx.availabilityRule.updateMany({
        where: {
          resourceId: args.resourceId,
          deletedAt: null,
          createdAt: { lt: latestActiveRuleCreatedAt },
        },
        data: { deletedAt: now },
      });
    }
    const activeOverridesCount = await tx.availabilityOverride.count({
      where: { resourceId: args.resourceId, deletedAt: null },
    });
    if (activeOverridesCount === 0) {
      const latestDeletedOverride = await tx.availabilityOverride.findFirst({
        where: { resourceId: args.resourceId, deletedAt: { not: null } },
        select: { deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      });
      if (latestDeletedOverride?.deletedAt != null) {
        await tx.availabilityOverride.updateMany({
          where: {
            resourceId: args.resourceId,
            deletedAt: latestDeletedOverride.deletedAt,
          },
          data: { deletedAt: null },
        });
      }
    }
    return tx.calendarResource.update({
      where: { id: args.resourceId },
      data: {
        name: args.name,
        isActive: true,
        deletedAt: null,
      },
      select: calendarResourceSelect,
    });
  }

  async deactivateSpecialistResourceDuplicatesTx(
    tx: Prisma.TransactionClient,
    args: { resourceIds: string[] },
  ): Promise<void> {
    if (args.resourceIds.length === 0) {
      return;
    }
    await tx.calendarResource.updateMany({
      where: { id: { in: args.resourceIds } },
      data: {
        isActive: false,
        specialistId: null,
        deletedAt: new Date(),
      },
    });
  }

  async createSpecialistResourceTx(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      specialistId: string;
      name: string;
      workdayStartMinute: number;
      workdayEndMinute: number;
    },
  ): Promise<CalendarResourceRow> {
    const resource = await tx.calendarResource.create({
      data: {
        organizationId: args.organizationId,
        specialistId: args.specialistId,
        type: CalendarResourceType.specialist,
        name: args.name,
        capacity: 1,
        isActive: true,
      },
      select: calendarResourceSelect,
    });
    await tx.availabilityRule.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        resourceId: resource.id,
        weekday,
        startMinute: args.workdayStartMinute,
        endMinute: args.workdayEndMinute,
        type: AvailabilityRuleType.working,
      })),
      skipDuplicates: true,
    });
    return resource;
  }

  findResourcesByIdsTx(
    tx: Prisma.TransactionClient,
    resourceIds: string[],
  ): Promise<CalendarResourceRow[]> {
    return tx.calendarResource.findMany({
      where: { id: { in: resourceIds } },
      select: calendarResourceSelect,
    });
  }

  listResourcesForOrganization(args: {
    organizationId: string;
    type?: CalendarResourceType;
    specialistId?: string;
  }): Promise<CalendarResourceRow[]> {
    return this.prisma.calendarResource.findMany({
      where: {
        organizationId: args.organizationId,
        deletedAt: null,
        isActive: true,
        ...(args.type != null ? { type: args.type } : {}),
        ...(args.specialistId != null
          ? { specialistId: args.specialistId }
          : {}),
      },
      select: calendarResourceSelect,
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async countBlockingOverlapsByResourceTx(
    tx: Prisma.TransactionClient,
    args: {
      resourceIds: string[];
      startsAt: Date;
      endsAt: Date;
      excludeEventId?: string | null;
    },
  ): Promise<Map<string, number>> {
    if (args.resourceIds.length === 0) {
      return new Map();
    }
    const rows = await tx.$queryRaw<
      Array<{ resourceId: string; count: bigint }>
    >(
      Prisma.sql`
        SELECT er."resourceId" AS "resourceId", COUNT(DISTINCT ce."id") AS "count"
        FROM "CalendarEventResource" er
        INNER JOIN "CalendarEvent" ce ON ce."id" = er."eventId"
        WHERE er."resourceId" IN (${Prisma.join(args.resourceIds)})
          AND ce."deletedAt" IS NULL
          AND ce."status" IN (${Prisma.join(CALENDAR_BLOCKING_EVENT_STATUSES)})
          AND ce."startsAt" < ${args.endsAt}
          AND ce."endsAt" > ${args.startsAt}
          ${
            args.excludeEventId != null
              ? Prisma.sql`AND ce."id" <> ${args.excludeEventId}`
              : Prisma.empty
          }
        GROUP BY er."resourceId"
      `,
    );
    return new Map(rows.map((r) => [r.resourceId, Number(r.count)]));
  }

  findAvailabilityRulesTx(
    tx: Prisma.TransactionClient,
    args: { resourceIds: string[]; weekday: number },
  ) {
    return tx.availabilityRule.findMany({
      where: {
        resourceId: { in: args.resourceIds },
        weekday: args.weekday,
        deletedAt: null,
      },
      select: {
        resourceId: true,
        startMinute: true,
        endMinute: true,
        type: true,
      },
    });
  }

  findAvailabilityOverridesTx(
    tx: Prisma.TransactionClient,
    args: { resourceIds: string[]; date: string },
  ) {
    return tx.availabilityOverride.findMany({
      where: {
        resourceId: { in: args.resourceIds },
        date: args.date,
        deletedAt: null,
      },
      select: {
        resourceId: true,
        startsAt: true,
        endsAt: true,
        type: true,
      },
    });
  }

  createBookingCalendarEventTx(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      bookingId: string | null;
      startsAt: Date;
      endsAt: Date;
      status: CalendarEventStatus;
      createdByUserId: string;
      resourceIds: string[];
    },
  ) {
    return tx.calendarEvent.create({
      data: {
        organizationId: args.organizationId,
        bookingId: args.bookingId,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        type: CalendarEventType.booking,
        status: args.status,
        createdByUserId: args.createdByUserId,
        resources: {
          create: args.resourceIds.map((resourceId) => ({
            resourceId,
            role: 'specialist',
          })),
        },
      },
      select: { id: true },
    });
  }

  updateCalendarEventBookingIdTx(
    tx: Prisma.TransactionClient,
    args: { eventId: string; bookingId: string },
  ) {
    return tx.calendarEvent.update({
      where: { id: args.eventId },
      data: { bookingId: args.bookingId },
      select: { id: true },
    });
  }

  updateEventStatusForBookingTx(
    tx: Prisma.TransactionClient,
    args: { eventId: string; status: CalendarEventStatus },
  ) {
    return tx.calendarEvent.update({
      where: { id: args.eventId },
      data: { status: args.status, version: { increment: 1 } },
      select: { id: true },
    });
  }

  listEventsForOrganization(args: {
    organizationId: string;
    from: Date;
    to: Date;
    resourceIds?: string[];
    limit: number;
    cursorStartsAt?: Date;
    cursorId?: string;
  }): Promise<CalendarEventListRow[]> {
    return this.prisma.calendarEvent.findMany({
      where: {
        organizationId: args.organizationId,
        deletedAt: null,
        status: { in: [...CALENDAR_VISIBLE_EVENT_STATUSES] },
        startsAt: { lt: args.to },
        endsAt: { gt: args.from },
        ...(args.resourceIds != null && args.resourceIds.length > 0
          ? { resources: { some: { resourceId: { in: args.resourceIds } } } }
          : {}),
        ...(args.cursorStartsAt != null && args.cursorId != null
          ? {
              OR: [
                { startsAt: { gt: args.cursorStartsAt } },
                { startsAt: args.cursorStartsAt, id: { gt: args.cursorId } },
              ],
            }
          : {}),
      },
      select: calendarEventListSelect,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: args.limit,
    });
  }

  createBlockEventTx(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      startsAt: Date;
      endsAt: Date;
      blockReason: CalendarBlockReason;
      createdByUserId: string;
      notes: string | null;
      resourceIds: string[];
    },
  ) {
    return tx.calendarEvent.create({
      data: {
        organizationId: args.organizationId,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        type: CalendarEventType.block,
        status: CalendarEventStatus.confirmed,
        blockReason: args.blockReason,
        createdByUserId: args.createdByUserId,
        notes: args.notes,
        resources: {
          create: args.resourceIds.map((resourceId) => ({ resourceId })),
        },
        audits: {
          create: {
            actorUserId: args.createdByUserId,
            action: 'created',
            payload: { blockReason: args.blockReason },
          },
        },
      },
      select: calendarEventListSelect,
    });
  }

  findEventForCommandTx(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<{
    id: string;
    organizationId: string;
    type: CalendarEventType;
    status: CalendarEventStatus;
    version: number;
    createdByUserId: string | null;
    resources: Array<{
      resource: {
        specialistId: string | null;
      };
    }>;
  } | null> {
    return tx.calendarEvent.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        type: true,
        status: true,
        version: true,
        createdByUserId: true,
        resources: {
          select: {
            resource: {
              select: { specialistId: true },
            },
          },
        },
      },
    });
  }

  async updateBlockEventTx(
    tx: Prisma.TransactionClient,
    args: {
      eventId: string;
      expectedVersion: number;
      startsAt: Date;
      endsAt: Date;
      blockReason?: CalendarBlockReason;
      notes?: string | null;
      resourceIds: string[];
      actorUserId: string;
    },
  ): Promise<CalendarEventListRow | null> {
    const updated = await tx.calendarEvent.updateMany({
      where: {
        id: args.eventId,
        type: CalendarEventType.block,
        version: args.expectedVersion,
        deletedAt: null,
      },
      data: {
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        ...(args.blockReason != null ? { blockReason: args.blockReason } : {}),
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    await tx.calendarEventResource.deleteMany({
      where: { eventId: args.eventId },
    });
    await tx.calendarEventResource.createMany({
      data: args.resourceIds.map((resourceId) => ({
        eventId: args.eventId,
        resourceId,
      })),
      skipDuplicates: true,
    });
    await tx.calendarEventAudit.create({
      data: {
        eventId: args.eventId,
        actorUserId: args.actorUserId,
        action: 'updated',
        payload: {
          resourceIds: args.resourceIds,
          blockReason: args.blockReason,
        },
      },
    });
    return tx.calendarEvent.findFirstOrThrow({
      where: { id: args.eventId },
      select: calendarEventListSelect,
    });
  }

  async deleteBlockEventTx(
    tx: Prisma.TransactionClient,
    args: { eventId: string; expectedVersion: number; actorUserId: string },
  ): Promise<boolean> {
    const updated = await tx.calendarEvent.updateMany({
      where: {
        id: args.eventId,
        type: CalendarEventType.block,
        version: args.expectedVersion,
        deletedAt: null,
      },
      data: {
        status: CalendarEventStatus.cancelled,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return false;
    }
    await tx.calendarEventAudit.create({
      data: {
        eventId: args.eventId,
        actorUserId: args.actorUserId,
        action: 'deleted',
        payload: {},
      },
    });
    return true;
  }
}
