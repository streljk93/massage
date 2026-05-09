import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingEventType,
  type BookingStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { AppendBookingEventInput } from '../domain/booking-event-actor';
import { inferBookingEventActorKind } from '../domain/booking-event-actor';
import { isBookingEventTypeAllowedFromCoarse } from '../domain/booking-event-allowed';
import { parseBookingEventPayload } from '../domain/booking-event-payload.schema';
import { reduceBookingCoarseState } from '../domain/booking-reducer';
import {
  materializedBookingMatchesProjectedRow,
  projectBookingRowFromTimeline,
  type BookingTimelineEvent,
} from '../domain/booking-projection';
import type { BookingCoarseState } from '../domain/booking-state.types';

function parseCanceledParty(
  parsedPayload: unknown,
): 'client' | 'specialist' | 'system' | null {
  if (parsedPayload == null || typeof parsedPayload !== 'object') {
    return null;
  }
  const p = parsedPayload as { cancelParty?: string };
  if (
    p.cancelParty === 'client' ||
    p.cancelParty === 'specialist' ||
    p.cancelParty === 'system'
  ) {
    return p.cancelParty;
  }
  return null;
}

@Injectable()
export class BookingAppendService {
  constructor(private readonly prisma: PrismaService) {}

  appendBookingEvent(
    tx: Prisma.TransactionClient,
    input: AppendBookingEventInput,
  ): Promise<{
    previousStatus: BookingStatus;
    projection: ReturnType<typeof projectBookingRowFromTimeline>;
  }> {
    return this.#appendBookingEvent(tx, input);
  }

  appendBookingEventNewTx(input: AppendBookingEventInput) {
    return this.prisma.$transaction((tx) => this.#appendBookingEvent(tx, input));
  }

  async #appendBookingEvent(
    tx: Prisma.TransactionClient,
    input: AppendBookingEventInput,
  ): Promise<{
    previousStatus: BookingStatus;
    projection: ReturnType<typeof projectBookingRowFromTimeline>;
  }> {
    const booking = await tx.booking.findFirst({
      where: { id: input.bookingId, deletedAt: null },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        pendingExpiresAt: true,
        cancelReason: true,
        cancellationComment: true,
        clientUserId: true,
        specialist: { select: { userId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }

    const prevRows = await tx.bookingEvent.findMany({
      where: { bookingId: input.bookingId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { type: true, payload: true },
    });
    const prevTimeline: BookingTimelineEvent[] = prevRows.map((r) => ({
      type: r.type,
      payload: r.payload,
    }));

    const parsedPayload = parseBookingEventPayload(input.type, input.payload);
    const coarseBefore: BookingCoarseState =
      prevRows.length === 0 ? null : reduceBookingCoarseState(prevRows);

    if (prevTimeline.length > 0) {
      const reconciledRow = projectBookingRowFromTimeline(prevTimeline);
      if (
        !materializedBookingMatchesProjectedRow(
          {
            status: booking.status,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            pendingExpiresAt: booking.pendingExpiresAt,
            cancelReason: booking.cancelReason,
            cancellationComment: booking.cancellationComment,
          },
          reconciledRow,
        )
      ) {
        throw new ConflictException({
          code: 'BOOKING_ROW_OUT_OF_SYNC_WITH_EVENTS',
          message:
            'Booking row no longer matches the event log projection; refusing append',
        });
      }
    }

    this.#guardIncomingEvent(prevTimeline.length, parsedPayload, {
      coarseBefore,
      type: input.type,
      allowMassOrgSpecialistCancel:
        input.allowMassOrgSpecialistCancel ?? false,
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: input.bookingId,
        type: input.type,
        actorKind:
          input.actorKindOverride?.trim()?.length ?
            input.actorKindOverride!.trim()
          : inferBookingEventActorKind({
              actorUserId: input.actorUserId,
              clientUserId: booking.clientUserId,
              specialistUserId: booking.specialist.userId,
            }),
        actorUserId: input.actorUserId,
        payload:
          parsedPayload === undefined ?
            undefined
          : (parsedPayload as object),
      },
    });

    const afterRows = await tx.bookingEvent.findMany({
      where: { bookingId: input.bookingId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { type: true, payload: true },
    });
    const timeline: BookingTimelineEvent[] = afterRows.map((r) => ({
      type: r.type,
      payload: r.payload,
    }));
    const projection = projectBookingRowFromTimeline(timeline);

    await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        status: projection.status,
        startsAt: projection.startsAt,
        endsAt: projection.endsAt,
        pendingExpiresAt: projection.pendingExpiresAt,
        cancelReason: projection.cancelReason,
        cancellationComment: projection.cancellationComment,
      },
    });

    return { previousStatus: booking.status, projection };
  }

  #guardIncomingEvent(
    prevEventCount: number,
    parsedPayload: unknown,
    gate: {
      coarseBefore: BookingCoarseState;
      type: BookingEventType;
      allowMassOrgSpecialistCancel: boolean;
    },
  ): void {
    if (gate.type === BookingEventType.created) {
      if (prevEventCount !== 0) {
        throw new BadRequestException({
          code: 'BOOKING_CREATED_NOT_FIRST_EVENT',
          message: 'BookingEvent created must be first in timeline',
        });
      }
      return;
    }
    if (prevEventCount === 0) {
      throw new BadRequestException({
        code: 'BOOKING_MISSING_CREATED',
        message: 'Append requires created bootstrap event first',
      });
    }

    const coarseBefore = gate.coarseBefore;
    if (coarseBefore === null) {
      throw new BadRequestException({
        code: 'BOOKING_COARSE_NULL',
        message: 'booking coarse state unresolved',
      });
    }

    /** Массовая отмена: `active` + `canceled` от мастера/системы (не клиент подтверждённый «отказ» клиента). */
    const activeMassSpecialistCancel =
      coarseBefore === 'active' &&
      gate.type === BookingEventType.canceled &&
      gate.allowMassOrgSpecialistCancel &&
      parseCanceledParty(parsedPayload) !== 'client';

    const coarseAllows = isBookingEventTypeAllowedFromCoarse(coarseBefore, gate.type);

    if (!coarseAllows && !activeMassSpecialistCancel) {
      throw new BadRequestException({
        code: 'BOOKING_EVENT_NOT_ALLOWED',
        message: `Event ${gate.type} not allowed from coarse state ${coarseBefore}`,
      });
    }

    if (
      gate.type === BookingEventType.canceled &&
      coarseBefore === 'active' &&
      parseCanceledParty(parsedPayload) === 'client'
    ) {
      throw new BadRequestException({
        code: 'BOOKING_CLIENT_CANCEL_AFTER_START',
        message: 'Client cannot cancel booking after visit started',
      });
    }
  }
}
