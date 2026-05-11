import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalendarBlockReason,
  CalendarEventType,
  CalendarResourceType,
  type Prisma,
} from '@prisma/client';
import { parseISO } from 'date-fns';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CalendarTxLocks } from '../domain/calendar-tx-locks';
import { CalendarAvailabilityService } from './calendar-availability.service';
import {
  CalendarRepository,
  type CalendarEventListRow,
  type CalendarResourceRow,
} from '../infrastructure/calendar.repository';
import { OrganizationAccessPolicyService } from '../../organizations/application/organization-access-policy.service';
import {
  OrganizationCalendarActions,
  OrganizationCapabilities,
  assertCanOrganization,
  canOrganization,
  type OrganizationAccessContext,
} from '../../organizations/domain/policy';
import {
  buildOrganizationScope,
  type OrganizationDataScope,
} from '../../organizations/domain/organization-scope';

type CalendarAccessContext = {
  userId: string;
  specialistId: string;
  organizationId: string;
  scope: OrganizationDataScope;
  access: OrganizationAccessContext;
};

function parseCalendarInstant(raw: string, field: string): Date {
  const d = parseISO(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({
      code: 'CALENDAR_INVALID_DATETIME',
      message: `${field} must be a valid ISO datetime`,
    });
  }
  return d;
}

function encodeCursor(row: { startsAt: string; id: string }): string {
  return Buffer.from(`${row.startsAt}|${row.id}`, 'utf8').toString('base64url');
}

function decodeCursor(
  raw: string | undefined,
): { startsAt: Date; id: string } | null {
  if (raw == null) {
    return null;
  }
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const sep = decoded.lastIndexOf('|');
    if (sep <= 0) {
      return null;
    }
    const startsAt = parseISO(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (Number.isNaN(startsAt.getTime()) || id.length === 0) {
      return null;
    }
    return { startsAt, id };
  } catch {
    return null;
  }
}

function eventSpecialistIdForPolicy(
  ctx: CalendarAccessContext,
  row: Pick<CalendarEventListRow, 'resources'>,
): string | null {
  const eventSpecialistIds = row.resources
    .map((er) => er.resource.specialistId)
    .filter((id): id is string => id != null);
  return eventSpecialistIds.length > 0 &&
    eventSpecialistIds.every((id) => id === ctx.specialistId)
    ? ctx.specialistId
    : null;
}

function canManageCalendarEvent(
  ctx: CalendarAccessContext,
  row: CalendarEventListRow,
) {
  if (row.type !== CalendarEventType.block) {
    return false;
  }
  return canOrganization(ctx.access, OrganizationCapabilities.CALENDAR, {
    type: 'Resource',
    action: OrganizationCalendarActions.MANAGE,
    organizationId: ctx.organizationId,
    specialistId: eventSpecialistIdForPolicy(ctx, row),
    createdByUserId: row.createdByUserId,
  });
}

function mapEvent(
  row: CalendarEventListRow,
  permissions: { manage: boolean } = { manage: false },
) {
  const booking = row.booking;
  const specialistName =
    booking?.specialist.listingName?.trim() ||
    booking?.specialist.user.name?.trim() ||
    null;
  const createdByDisplayName =
    row.createdByUser?.name?.trim() || row.createdByUser?.email?.trim() || null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    bookingId: booking?.id ?? row.bookingId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    type: row.type,
    status: row.status,
    blockReason: row.blockReason,
    notes: row.notes,
    createdByDisplayName,
    version: row.version,
    resources: row.resources.map((er) => ({
      id: er.resource.id,
      type: er.resource.type,
      name: er.resource.name,
      specialistId: er.resource.specialistId,
      role: er.role,
    })),
    permissions,
    booking:
      booking == null
        ? null
        : {
            id: booking.id,
            status: booking.status,
            clientDisplayName: booking.client.name,
            specialistName,
            categoryShortName: booking.categoryShortNameSnapshot ?? '',
            amount: booking.priceAmountSnapshot,
            currency: booking.currencySnapshot ?? 'VND',
          },
  };
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarRepository: CalendarRepository,
    private readonly availability: CalendarAvailabilityService,
    private readonly organizationAccess: OrganizationAccessPolicyService,
  ) {}

  async ensureSpecialistResourceForOrganizationTx(
    tx: Prisma.TransactionClient,
    args: { organizationId: string; specialistId: string },
  ): Promise<CalendarResourceRow> {
    await CalendarTxLocks.acquireResourceIdentity(tx, args);
    const existing = await this.calendarRepository.findSpecialistResourceTx(
      tx,
      args,
    );
    if (existing != null) {
      return existing;
    }
    const specialist = await tx.specialist.findFirst({
      where: { id: args.specialistId, deletedAt: null },
      select: {
        listingName: true,
        user: { select: { name: true } },
      },
    });
    const organization = await tx.organization.findFirst({
      where: { id: args.organizationId, deletedAt: null },
      select: {
        listingWorkdayStartMinute: true,
        listingWorkdayEndMinute: true,
      },
    });
    if (specialist == null || organization == null) {
      throw new BadRequestException({
        code: 'CALENDAR_RESOURCE_CONTEXT_NOT_FOUND',
        message:
          'Specialist or organization was not found for calendar resource',
      });
    }
    return this.calendarRepository.createSpecialistResourceTx(tx, {
      organizationId: args.organizationId,
      specialistId: args.specialistId,
      name:
        specialist.listingName?.trim() ||
        specialist.user.name?.trim() ||
        'Specialist',
      workdayStartMinute: organization.listingWorkdayStartMinute,
      workdayEndMinute: organization.listingWorkdayEndMinute,
    });
  }

  async listResources(userId: string): Promise<{
    organizationId: string;
    resources: Array<{
      id: string;
      type: string;
      specialistId: string | null;
      name: string;
      capacity: number;
      isActive: boolean;
    }>;
  }> {
    const ctx = await this.resolveAccessContext(userId);
    const ownResource = await this.prisma.$transaction((tx) =>
      this.ensureSpecialistResourceForOrganizationTx(tx, {
        organizationId: ctx.organizationId,
        specialistId: ctx.specialistId,
      }),
    );
    const resources =
      await this.calendarRepository.listResourcesForOrganization({
        organizationId: ctx.organizationId,
        type: CalendarResourceType.specialist,
        ...ctx.scope.resources,
      });
    const list = resources.length > 0 ? resources : [ownResource];
    return {
      organizationId: ctx.organizationId,
      resources: list.map((r) => ({
        id: r.id,
        type: r.type,
        specialistId: r.specialistId,
        name: r.name,
        capacity: r.capacity,
        isActive: r.isActive,
      })),
    };
  }

  async listEvents(
    userId: string,
    args: {
      from: string;
      to: string;
      resourceIds?: string[];
      limit?: number;
      cursor?: string;
    },
  ) {
    const ctx = await this.resolveAccessContext(userId);
    const from = parseCalendarInstant(args.from, 'from');
    const to = parseCalendarInstant(args.to, 'to');
    if (to.getTime() <= from.getTime()) {
      throw new BadRequestException({
        code: 'CALENDAR_INVALID_RANGE',
        message: 'to must be after from',
      });
    }
    const allowedResources =
      await this.calendarRepository.listResourcesForOrganization({
        organizationId: ctx.organizationId,
        type: CalendarResourceType.specialist,
        ...ctx.scope.resources,
      });
    const allowedIds = new Set(allowedResources.map((r) => r.id));
    const requested = args.resourceIds?.length
      ? [...new Set(args.resourceIds)]
      : [...allowedIds];
    if (requested.some((id) => !allowedIds.has(id))) {
      throw new ForbiddenException({
        code: 'CALENDAR_RESOURCE_FORBIDDEN',
        message: 'You cannot access one or more calendar resources',
      });
    }
    const cursor = decodeCursor(args.cursor);
    if (args.cursor != null && cursor == null) {
      throw new BadRequestException({
        code: 'CALENDAR_CURSOR_INVALID',
        message: 'Invalid calendar cursor',
      });
    }
    const limit = args.limit ?? 150;
    const rows = await this.calendarRepository.listEventsForOrganization({
      organizationId: ctx.organizationId,
      from,
      to,
      resourceIds: requested,
      limit: limit + 1,
      cursorStartsAt: cursor?.startsAt,
      cursorId: cursor?.id,
    });
    const page = rows.slice(0, limit);
    const tail = rows.length > limit ? page[page.length - 1] : null;
    return {
      organizationId: ctx.organizationId,
      events: page.map((row) =>
        mapEvent(row, { manage: canManageCalendarEvent(ctx, row) }),
      ),
      nextCursor:
        tail == null
          ? null
          : encodeCursor({
              startsAt: tail.startsAt.toISOString(),
              id: tail.id,
            }),
    };
  }

  async createBlock(
    userId: string,
    args: {
      startsAt: string;
      endsAt: string;
      resourceIds: string[];
      blockReason: CalendarBlockReason;
      notes?: string | null;
    },
  ) {
    const ctx = await this.resolveAccessContext(userId);
    const startsAt = parseCalendarInstant(args.startsAt, 'startsAt');
    const endsAt = parseCalendarInstant(args.endsAt, 'endsAt');
    const resourceIds = [...new Set(args.resourceIds)].sort();
    await this.assertResourcesAllowed(ctx, resourceIds);
    const created = await this.prisma.$transaction(async (tx) => {
      await this.availability.assertSlotAvailableForResourcesTx(tx, {
        organizationId: ctx.organizationId,
        resourceIds,
        startsAt,
        endsAt,
        requireWorkingAvailability: false,
      });
      return this.calendarRepository.createBlockEventTx(tx, {
        organizationId: ctx.organizationId,
        startsAt,
        endsAt,
        blockReason: args.blockReason,
        createdByUserId: ctx.userId,
        notes: args.notes?.trim() || null,
        resourceIds,
      });
    });
    return {
      event: mapEvent(created, {
        manage: canManageCalendarEvent(ctx, created),
      }),
    };
  }

  async updateBlock(
    userId: string,
    eventId: string,
    args: {
      startsAt: string;
      endsAt: string;
      resourceIds: string[];
      blockReason?: CalendarBlockReason;
      notes?: string | null;
      version: number;
    },
  ) {
    const ctx = await this.resolveAccessContext(userId);
    const startsAt = parseCalendarInstant(args.startsAt, 'startsAt');
    const endsAt = parseCalendarInstant(args.endsAt, 'endsAt');
    const resourceIds = [...new Set(args.resourceIds)].sort();
    await this.assertResourcesAllowed(ctx, resourceIds);
    const updated = await this.prisma.$transaction(async (tx) => {
      const orgAccessCtx = await this.organizationAccess.resolveContextTx(
        tx,
        userId,
        ctx.organizationId,
      );
      const event = await this.calendarRepository.findEventForCommandTx(
        tx,
        eventId,
      );
      this.assertBlockCommandAllowed({ ...ctx, access: orgAccessCtx }, event);
      await this.availability.assertSlotAvailableForResourcesTx(tx, {
        organizationId: ctx.organizationId,
        resourceIds,
        startsAt,
        endsAt,
        requireWorkingAvailability: false,
        excludeEventId: eventId,
      });
      return this.calendarRepository.updateBlockEventTx(tx, {
        eventId,
        expectedVersion: args.version,
        startsAt,
        endsAt,
        blockReason: args.blockReason,
        notes:
          args.notes === undefined ? undefined : args.notes?.trim() || null,
        resourceIds,
        actorUserId: ctx.userId,
      });
    });
    if (updated == null) {
      throw new ConflictException({
        code: 'CALENDAR_EVENT_VERSION_CONFLICT',
        message: 'Calendar event was changed by another request',
      });
    }
    return {
      event: mapEvent(updated, {
        manage: canManageCalendarEvent(ctx, updated),
      }),
    };
  }

  async deleteBlock(
    userId: string,
    eventId: string,
    version: number,
  ): Promise<{ id: string; deleted: true }> {
    const ctx = await this.resolveAccessContext(userId);
    const deleted = await this.prisma.$transaction(async (tx) => {
      const orgAccessCtx = await this.organizationAccess.resolveContextTx(
        tx,
        userId,
        ctx.organizationId,
      );
      const event = await this.calendarRepository.findEventForCommandTx(
        tx,
        eventId,
      );
      this.assertBlockCommandAllowed({ ...ctx, access: orgAccessCtx }, event);
      return this.calendarRepository.deleteBlockEventTx(tx, {
        eventId,
        expectedVersion: version,
        actorUserId: ctx.userId,
      });
    });
    if (!deleted) {
      throw new ConflictException({
        code: 'CALENDAR_EVENT_VERSION_CONFLICT',
        message: 'Calendar event was changed by another request',
      });
    }
    return { id: eventId, deleted: true };
  }

  private async assertResourcesAllowed(
    ctx: CalendarAccessContext,
    resourceIds: string[],
  ): Promise<void> {
    const allowed = await this.calendarRepository.listResourcesForOrganization({
      organizationId: ctx.organizationId,
      type: CalendarResourceType.specialist,
      ...ctx.scope.resources,
    });
    const allowedIds = new Set(allowed.map((r) => r.id));
    if (resourceIds.some((id) => !allowedIds.has(id))) {
      throw new ForbiddenException({
        code: 'CALENDAR_RESOURCE_FORBIDDEN',
        message: 'You cannot modify one or more calendar resources',
      });
    }
  }

  private assertBlockCommandAllowed(
    ctx: CalendarAccessContext,
    event: {
      id: string;
      organizationId: string;
      type: CalendarEventType;
      status: string;
      createdByUserId: string | null;
      resources: Array<{
        resource: {
          specialistId: string | null;
        };
      }>;
    } | null,
  ): asserts event is {
    id: string;
    organizationId: string;
    type: CalendarEventType;
    status: string;
    createdByUserId: string | null;
    resources: Array<{
      resource: {
        specialistId: string | null;
      };
    }>;
  } {
    if (event == null) {
      throw new NotFoundException({
        code: 'CALENDAR_EVENT_NOT_FOUND',
        message: 'Calendar event not found',
      });
    }
    if (event.organizationId !== ctx.organizationId) {
      throw new ForbiddenException({
        code: 'CALENDAR_EVENT_FORBIDDEN',
        message: 'Calendar event belongs to another organization',
      });
    }
    if (event.type !== CalendarEventType.block) {
      throw new BadRequestException({
        code: 'CALENDAR_BOOKING_EVENT_IMMUTABLE',
        message:
          'Booking calendar events can only be changed through booking lifecycle',
      });
    }
    const eventSpecialistIds = event.resources
      .map((er) => er.resource.specialistId)
      .filter((id): id is string => id != null);
    const specialistId =
      eventSpecialistIds.length > 0 &&
      eventSpecialistIds.every((id) => id === ctx.specialistId)
        ? ctx.specialistId
        : null;
    assertCanOrganization(ctx.access, OrganizationCapabilities.CALENDAR, {
      type: 'Resource',
      action: OrganizationCalendarActions.MANAGE,
      organizationId: ctx.organizationId,
      specialistId,
      createdByUserId: event.createdByUserId,
    });
  }

  private async resolveAccessContext(
    userId: string,
  ): Promise<CalendarAccessContext> {
    const specialist = await this.prisma.specialist.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, activeOrganizationId: true },
    });
    if (specialist == null) {
      throw new NotFoundException({
        code: 'SPECIALIST_PROFILE_NOT_FOUND',
        message: 'Specialist profile not found',
      });
    }
    if (specialist.activeOrganizationId == null) {
      throw new NotFoundException({
        code: 'ACTIVE_ORGANIZATION_NOT_FOUND',
        message: 'Active organization is required for calendar',
      });
    }
    const orgCtx = await this.organizationAccess.resolveContext(
      userId,
      specialist.activeOrganizationId,
    );
    assertCanOrganization(orgCtx, OrganizationCapabilities.CALENDAR, {
      type: 'Resource',
      action: OrganizationCalendarActions.VIEW,
      organizationId: specialist.activeOrganizationId,
      specialistId: specialist.id,
    });
    return {
      userId,
      specialistId: specialist.id,
      organizationId: specialist.activeOrganizationId,
      scope: buildOrganizationScope(orgCtx),
      access: orgCtx,
    };
  }
}
