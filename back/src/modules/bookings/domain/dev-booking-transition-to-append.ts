import { BookingEventType, type BookingStatus } from '@prisma/client';
import type { AppendBookingEventInput } from './booking-event-actor';
import {
  BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
} from './booking-cancel-reason';
import { BOOKING_EVENT_TRANSITION_DEV } from './booking-event-transition-kind';

/** Тексты причин для dev-append (попадают в payload). */
function joinReasonPieces(args: {
  reasonFreeText?: string | null;
  cancelReason?: string | null;
  cancellationComment?: string | null;
}): string | null {
  const parts = [
    args.cancelReason,
    args.cancellationComment,
    args.reasonFreeText,
  ]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join(' | ') : null;
}

function metaDevPayload(args: {
  from: BookingStatus;
  to: BookingStatus;
  reasonFreeText?: string | null;
  cancelReason?: string | null;
  cancellationComment?: string | null;
}): Record<string, unknown> {
  return {
    transitionKindDev: BOOKING_EVENT_TRANSITION_DEV,
    fromStatusHint: args.from,
    toStatusHint: args.to,
    reasonText:
      args.reasonFreeText ??
      joinReasonPieces({
        cancelReason: args.cancelReason,
        cancellationComment: args.cancellationComment,
      }),
    reasonCode:
      typeof args.cancelReason === 'string' && args.cancelReason.length > 0 ?
        args.cancelReason
      : undefined,
    cancellationComment: args.cancellationComment ?? undefined,
  };
}

/**
 * Один «шаг» смены `BookingStatus` в dev: маппер в один append события.
 * Цепочка `pending→confirmed` в приложении уже разбита на `created + confirmed`; dev чаще
 * переходит уже с живой бронью с журналом.
 */
export function devBookingStatusHopToAppend(
  bookingId: string,
  args: {
    fromStatus: BookingStatus;
    toStatus: BookingStatus;
    reasonFreeText?: string | null;
    cancelReason?: string | null;
    cancellationComment?: string | null;
  },
): AppendBookingEventInput {
  const meta = metaDevPayload({
    from: args.fromStatus,
    to: args.toStatus,
    reasonFreeText: args.reasonFreeText,
    cancelReason: args.cancelReason,
    cancellationComment: args.cancellationComment,
  });
  const from = args.fromStatus;
  const to = args.toStatus;

  if (from === 'pending' && to === 'confirmed') {
    return {
      bookingId,
      type: BookingEventType.confirmed,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {},
    };
  }
  if (from === 'pending' && to === 'reject_by_master') {
    return {
      bookingId,
      type: BookingEventType.rejected,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {
        rejectParty: 'specialist',
        reasonText:
          typeof meta.reasonText === 'string' ? meta.reasonText : undefined,
      },
    };
  }
  if (from === 'pending' && to === 'reject_by_client') {
    return {
      bookingId,
      type: BookingEventType.canceled,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {
        cancelParty: 'client',
        ...meta,
      },
    };
  }
  if (from === 'pending' && to === 'expired') {
    return {
      bookingId,
      type: BookingEventType.expired,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {
        reasonCode:
          typeof args.cancelReason === 'string' && args.cancelReason.length > 0 ?
            args.cancelReason
          : BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
        reasonText:
          typeof meta.reasonText === 'string' ? meta.reasonText : undefined,
      },
    };
  }

  if (from === 'confirmed' && to === 'in_progress') {
    return {
      bookingId,
      type: BookingEventType.started,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {},
    };
  }

  if (from === 'confirmed' && to === 'no_show_by_client') {
    return {
      bookingId,
      type: BookingEventType.no_show,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {
        party: 'client',
        ...meta,
      },
    };
  }
  if (from === 'confirmed' && to === 'no_show_by_master') {
    return {
      bookingId,
      type: BookingEventType.no_show,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {
        party: 'specialist',
        ...meta,
      },
    };
  }

  if (
    from === 'confirmed' &&
    (to === 'canceled_by_master' || to === 'canceled_by_client')
  ) {
    return {
      bookingId,
      type: BookingEventType.canceled,
      actorUserId: null,
      actorKindOverride: 'system',
      payload: {
        cancelParty:
          to === 'canceled_by_client' ? 'client' : 'specialist',
        cancellationComment: args.cancellationComment ?? undefined,
        reasonCode: args.cancelReason ?? undefined,
        reasonText:
          typeof meta.reasonText === 'string' ? meta.reasonText : undefined,
        ...meta,
      },
    };
  }

  if (
    from === 'in_progress' &&
    (to === 'canceled_by_master' || to === 'canceled_by_client')
  ) {
    return {
      bookingId,
      type: BookingEventType.canceled,
      actorUserId: null,
      actorKindOverride: 'system',
      allowMassOrgSpecialistCancel: true,
      payload: {
        cancelParty:
          to === 'canceled_by_client' ? 'client' : 'specialist',
        cancellationComment: args.cancellationComment ?? undefined,
        reasonCode: args.cancelReason ?? undefined,
        reasonText:
          typeof meta.reasonText === 'string' ? meta.reasonText : undefined,
        ...meta,
      },
    };
  }

  if (from === 'in_progress' && to === 'done') {
    const reasonTextJoined = joinReasonPieces({
      reasonFreeText: args.reasonFreeText,
      cancelReason: args.cancelReason,
      cancellationComment: args.cancellationComment,
    });
    return {
      bookingId,
      type: BookingEventType.completed,
      actorUserId: null,
      actorKindOverride: 'system',
      payload:
        reasonTextJoined != null ?
          {
            reasonText: reasonTextJoined,
            reasonCode: args.cancelReason ?? undefined,
          }
        : {},
    };
  }

  throw new Error(
    `DEV booking transition not mapped via events yet: ${from} -> ${to}`,
  );
}
