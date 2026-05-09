import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingActorKind,
  BookingEventType,
  type BookingStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BookingTxLocks } from '../domain/booking-tx-locks';
import type { AppendBookingEventInput } from '../domain/booking-event-actor';
import { inferBookingEventActorKind } from '../domain/booking-event-actor';
import { isBookingEventTypeAllowedFromCoarse } from '../domain/booking-event-allowed';
import { stableStringifyJson } from '../domain/booking-json-stable';
import { parseBookingEventPayload } from '../domain/booking-event-payload.schema';
import { computeBookingProjectionHash } from '../domain/booking-projection-hash';
import { commitProjectedBookingRow } from '../domain/booking-projection-commit';
import { shouldVerifyProjectionHashAgainstJournal } from '../domain/booking-projection-cursor';
import { reduceBookingCoarseState } from '../domain/booking-reducer';
import {
  materializedBookingMatchesProjectedRow,
  projectBookingRowFromTimeline,
  type BookingTimelineEvent,
} from '../domain/booking-projection';
import type { BookingCoarseState } from '../domain/booking-state.types';
import { assertStrictGranularTransitionForAppend } from '../domain/booking-strict-append';

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

function normalizedIdempotencyKey(
  raw: string | null | undefined,
): string | null {
  if (raw == null) {
    return null;
  }
  const t = raw.trim();
  if (t.length === 0) {
    return null;
  }
  if (t.length > 200) {
    throw new BadRequestException({
      code: 'BOOKING_IDEMPOTENCY_KEY_TOO_LONG',
      message: 'idempotencyKey must be at most 200 characters',
    });
  }
  return t;
}

function resolveActorKind(
  input: AppendBookingEventInput,
  booking: {
    clientUserId: string;
    specialist: { userId: string };
  },
): BookingActorKind {
  if (input.actorKindOverride != null) {
    return input.actorKindOverride;
  }
  return inferBookingEventActorKind({
    actorUserId: input.actorUserId,
    clientUserId: booking.clientUserId,
    specialistUserId: booking.specialist.userId,
  });
}

const bookingAppendRowSelect = {
  id: true,
  status: true,
  startsAt: true,
  endsAt: true,
  pendingExpiresAt: true,
  cancelReason: true,
  cancellationComment: true,
  clientUserId: true,
  version: true,
  lastAppliedSequence: true,
  projectionHash: true,
  specialist: { select: { userId: true } },
} satisfies Prisma.BookingSelect;

type BookingAppendRowShape = Prisma.BookingGetPayload<{
  select: typeof bookingAppendRowSelect;
}>;

@Injectable()
export class BookingAppendService {
  readonly #logger = new Logger(BookingAppendService.name);

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
    return this.prisma.$transaction((tx) =>
      this.#appendBookingEvent(tx, input),
    );
  }

  async #appendBookingEvent(
    tx: Prisma.TransactionClient,
    input: AppendBookingEventInput,
  ): Promise<{
    previousStatus: BookingStatus;
    projection: ReturnType<typeof projectBookingRowFromTimeline>;
  }> {
    await BookingTxLocks.acquireAggregateAppend(tx, input.bookingId);

    const idempotencyKey = normalizedIdempotencyKey(input.idempotencyKey);

    const bookingLookup = await tx.booking.findFirst({
      where: { id: input.bookingId, deletedAt: null },
      select: bookingAppendRowSelect,
    });
    if (!bookingLookup) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found',
      });
    }
    let booking: BookingAppendRowShape = bookingLookup;

    if (idempotencyKey != null) {
      const existing = await tx.bookingEvent.findFirst({
        where: { bookingId: input.bookingId, idempotencyKey },
        select: { type: true, payload: true, id: true, localSequence: true },
      });
      if (existing != null) {
        if (existing.type !== input.type) {
          throw new ConflictException({
            code: 'BOOKING_IDEMPOTENCY_TYPE_MISMATCH',
            message: 'idempotencyKey already used for a different event type',
          });
        }
        const parsedPayload = parseBookingEventPayload(
          input.type,
          input.payload,
        );
        const existingParsed = parseBookingEventPayload(
          existing.type,
          existing.payload,
        );
        if (
          stableStringifyJson(existingParsed) !==
          stableStringifyJson(parsedPayload)
        ) {
          throw new ConflictException({
            code: 'BOOKING_IDEMPOTENCY_PAYLOAD_MISMATCH',
            message: 'idempotencyKey already used with a different payload',
          });
        }
        const all = await tx.bookingEvent.findMany({
          where: { bookingId: input.bookingId },
          orderBy: [{ localSequence: 'asc' }, { id: 'asc' }],
          select: { type: true, payload: true },
        });
        const timeline: BookingTimelineEvent[] = all.map((r) => ({
          type: r.type,
          payload: r.payload,
        }));
        const projection = projectBookingRowFromTimeline(timeline);
        return { previousStatus: booking.status, projection };
      }
    }

    const prevRows = await tx.bookingEvent.findMany({
      where: { bookingId: input.bookingId },
      orderBy: [{ localSequence: 'asc' }, { id: 'asc' }],
      select: { type: true, payload: true },
    });
    const prevTimeline: BookingTimelineEvent[] = prevRows.map((r) => ({
      type: r.type,
      payload: r.payload,
    }));

    const parsedPayload = parseBookingEventPayload(input.type, input.payload);
    const verifyProj: ReturnType<typeof projectBookingRowFromTimeline> | null =
      prevTimeline.length > 0
        ? projectBookingRowFromTimeline(prevTimeline)
        : null;
    const tailEvt =
      prevTimeline.length > 0
        ? await tx.bookingEvent.findFirst({
            where: { bookingId: input.bookingId },
            orderBy: [{ localSequence: 'desc' }, { id: 'desc' }],
            select: { id: true, localSequence: true },
          })
        : null;

    if (
      shouldVerifyProjectionHashAgainstJournal(
        booking.version,
        booking.projectionHash,
      ) &&
      tailEvt != null &&
      verifyProj != null
    ) {
      const expectedHash = computeBookingProjectionHash({
        projection: verifyProj,
        lastEventId: tailEvt.id,
        localSequence: tailEvt.localSequence,
      });
      if (booking.projectionHash !== expectedHash) {
        const hashHeal = await commitProjectedBookingRow(tx, {
          bookingId: input.bookingId,
          expectedVersion: booking.version,
          projection: verifyProj,
          lastEventId: tailEvt.id,
          lastLocalSequence: tailEvt.localSequence,
        });
        if (hashHeal.count !== 1) {
          throw new ConflictException({
            code: 'BOOKING_APPEND_VERSION_CONFLICT',
            message: 'Concurrent booking update; retry append',
          });
        }
        booking = await tx.booking.findFirstOrThrow({
          where: { id: input.bookingId, deletedAt: null },
          select: bookingAppendRowSelect,
        });
      }
    }

    if (
      verifyProj != null &&
      tailEvt != null &&
      !materializedBookingMatchesProjectedRow(
        {
          status: booking.status,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          pendingExpiresAt: booking.pendingExpiresAt,
          cancelReason: booking.cancelReason,
          cancellationComment: booking.cancellationComment,
        },
        verifyProj,
      )
    ) {
      const rowHeal = await commitProjectedBookingRow(tx, {
        bookingId: input.bookingId,
        expectedVersion: booking.version,
        projection: verifyProj,
        lastEventId: tailEvt.id,
        lastLocalSequence: tailEvt.localSequence,
      });
      if (rowHeal.count !== 1) {
        throw new ConflictException({
          code: 'BOOKING_APPEND_VERSION_CONFLICT',
          message: 'Concurrent booking update; retry append',
        });
      }
      booking = await tx.booking.findFirstOrThrow({
        where: { id: input.bookingId, deletedAt: null },
        select: bookingAppendRowSelect,
      });
    }

    this.#guardIncomingEvent(prevRows.length, parsedPayload, {
      coarseBefore:
        prevRows.length === 0 ? null : reduceBookingCoarseState(prevRows),
      type: input.type,
      allowMassOrgSpecialistCancel: input.allowMassOrgSpecialistCancel ?? false,
    });

    const maxSeqRow = await tx.bookingEvent.findFirst({
      where: { bookingId: input.bookingId },
      orderBy: [{ localSequence: 'desc' }, { id: 'desc' }],
      select: { localSequence: true },
    });
    const nextLocalSequence = (maxSeqRow?.localSequence ?? 0) + 1;

    const tailAfterReRead = await tx.bookingEvent.findMany({
      where: { bookingId: input.bookingId },
      orderBy: [{ localSequence: 'asc' }, { id: 'asc' }],
      select: { type: true, payload: true },
    });
    if (tailAfterReRead.length !== prevRows.length) {
      throw new ConflictException({
        code: 'BOOKING_APPEND_RACE_REREAD',
        message: 'Journal changed during append; retry the operation',
      });
    }
    for (let i = 0; i < prevRows.length; i++) {
      const a = prevRows[i];
      const b = tailAfterReRead[i];
      if (
        a.type !== b.type ||
        stableStringifyJson(a.payload) !== stableStringifyJson(b.payload)
      ) {
        throw new ConflictException({
          code: 'BOOKING_APPEND_RACE_REREAD',
          message: 'Journal changed during append; retry the operation',
        });
      }
    }

    const prefixAfterReRead: BookingTimelineEvent[] = tailAfterReRead.map(
      (r) => ({ type: r.type, payload: r.payload }),
    );
    /**
     * Strict сразу перед INSERT на префиксе журнала после immediate re-read (план v14 §6).
     * Финальная материализация — lenient {@link projectBookingRowFromTimeline} по полному журналу.
     */
    assertStrictGranularTransitionForAppend({
      prevTimeline: prefixAfterReRead,
      tentativeNewEvent: { type: input.type, payload: parsedPayload },
    });

    const createdEv = await tx.bookingEvent.create({
      data: {
        bookingId: input.bookingId,
        type: input.type,
        localSequence: nextLocalSequence,
        idempotencyKey,
        actorKind: resolveActorKind(input, booking),
        actorUserId: input.actorUserId,
        payload:
          parsedPayload === undefined ? undefined : (parsedPayload as object),
      },
      select: { id: true, localSequence: true },
    });

    const afterRows = await tx.bookingEvent.findMany({
      where: { bookingId: input.bookingId },
      orderBy: [{ localSequence: 'asc' }, { id: 'asc' }],
      select: { type: true, payload: true },
    });
    const timeline: BookingTimelineEvent[] = afterRows.map((r) => ({
      type: r.type,
      payload: r.payload,
    }));
    const projection = projectBookingRowFromTimeline(timeline);

    const updated = await commitProjectedBookingRow(tx, {
      bookingId: input.bookingId,
      expectedVersion: booking.version,
      projection,
      lastEventId: createdEv.id,
      lastLocalSequence: createdEv.localSequence,
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'BOOKING_APPEND_VERSION_CONFLICT',
        message: 'Concurrent booking update; retry append',
      });
    }

    this.#logger.debug(
      `append ok booking=${input.bookingId} seq=${createdEv.localSequence} version+=1`,
    );

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

    const coarseAllows = isBookingEventTypeAllowedFromCoarse(
      coarseBefore,
      gate.type,
    );

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
