import { BookingStatus, type BookingEventType } from '@prisma/client';

import {
  BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT,
  BOOKING_COMPLETED_EVENT_REASON_CODE_AUTO_DONE_AT_SLOT_END,
} from './booking-cancel-reason';
import {
  coerceDate,
  parseBookingEventPayload,
} from './booking-event-payload.schema';
import type { BookingCoarseState } from './booking-state.types';
import { BOOKING_STATUS_ALL_ORDERED } from './booking-status-all-ordered';

export type BookingTimelineEvent = {
  type: BookingEventType;
  payload: unknown | null;
};

export type BookingRowProjection = {
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  pendingExpiresAt: Date | null;
  cancelReason: string | null;
  cancellationComment: string | null;
};

function granularToCoarse(granular: BookingStatus): Exclude<BookingCoarseState, null> {
  switch (granular) {
    case 'pending':
      return 'pending';
    case 'confirmed':
      return 'confirmed';
    case 'in_progress':
      return 'active';
    case 'done':
      return 'completed';
    case 'reject_by_master':
    case 'reject_by_client':
      return 'rejected';
    case 'canceled_by_master':
    case 'canceled_by_client':
      return 'canceled';
    case 'expired':
      return 'expired';
    case 'no_show_by_client':
    case 'no_show_by_master':
      return 'no_show';
    default: {
      const _n: never = granular;
      return _n;
    }
  }
}

function normalizeCancelTexts(args: {
  reasonCode?: string | null | undefined;
  reasonText?: string | null | undefined;
  cancellationComment?: string | null | undefined;
}): { cancelReason: string | null; cancellationComment: string | null } {
  const cc =
    typeof args.cancellationComment === 'string' &&
    args.cancellationComment.trim().length > 0 ?
      args.cancellationComment.trim()
    : null;
  const texts = [
    args.reasonCode?.trim() ?? '',
    args.reasonText?.trim() ?? '',
  ].filter((s) => s.length > 0);
  const synthetic = texts.join(' | ');
  const cancelReason: string | null =
    synthetic.length > 0 ? synthetic : args.reasonCode?.trim() ?? null;

  const finalReason =
    cancelReason === null &&
    BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT === args.reasonCode ?
      BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT
    : cancelReason;

  return {
    cancelReason: finalReason === '' ? args.reasonCode?.trim() ?? null : finalReason,
    cancellationComment: cc,
  };
}

/** Подсказки миграции / dev: строки enum `BookingStatus`. */
function tryHintedBookingStatus(raw: unknown): BookingStatus | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const v = raw.trim().toLowerCase();
  return (BOOKING_STATUS_ALL_ORDERED as readonly string[]).includes(v) ?
      (v as BookingStatus)
    : null;
}

/**
 * Детерминированная проекция строки Booking по упорядоченному журналу событий.
 * Порядок: `localSequence ASC`, затем `id ASC`.
 *
 * Применение проекции после записи в журнал — **lenient** по смыслу плана v14: парсинг payload
 * через Zod; **strict** (матрица статусов) выполняется на входе append до INSERT.
 */
export function projectBookingRowFromTimeline(
  events: BookingTimelineEvent[],
): BookingRowProjection {
  if (events.length < 1) {
    throw new Error('booking_events_empty');
  }
  let status: BookingStatus = 'pending';
  let startsAt = new Date(0);
  let endsAt = new Date(0);
  let pendingExpiresAt: Date | null = null;
  let cancelReason: string | null = null;
  let cancellationComment: string | null = null;

  for (const raw of events) {
    const p = parseBookingEventPayload(raw.type, raw.payload);
    switch (raw.type) {
      case 'created': {
        const pl = p as Record<string, unknown>;
        startsAt = coerceDate(pl.startsAt);
        endsAt = coerceDate(pl.endsAt);
        status = 'pending';
        pendingExpiresAt =
          pl.pendingExpiresAt == null ?
            null
          : coerceDate(pl.pendingExpiresAt);
        cancelReason = null;
        cancellationComment = null;
        break;
      }
      case 'confirmed': {
        status = 'confirmed';
        pendingExpiresAt = null;
        break;
      }
      case 'rejected': {
        const pl = p as Record<string, unknown>;
        const party = pl.rejectParty === 'specialist' ? 'specialist' : 'client';
        status =
          party === 'specialist' ? 'reject_by_master' : 'reject_by_client';
        pendingExpiresAt = null;
        const norm = normalizeCancelTexts({
          reasonCode:
            typeof pl.reasonCode === 'string' ? pl.reasonCode : null,
          reasonText:
            typeof pl.reasonText === 'string' ?
              pl.reasonText
            : typeof pl.reason === 'string' ? pl.reason
            : null,
          cancellationComment:
            typeof pl.cancellationComment === 'string' ?
              pl.cancellationComment
            : null,
        });
        if (norm.cancelReason != null || norm.cancellationComment != null) {
          cancelReason = norm.cancelReason;
          cancellationComment = norm.cancellationComment;
        }
        break;
      }
      case 'canceled': {
        const pl = p as Record<string, unknown>;
        const hinted =
          typeof pl.toStatusHint === 'string' ?
            tryHintedBookingStatus(pl.toStatusHint)
          : null;
        const devOrUnknown =
          pl.devOrUnknownTransition === true && hinted !== null;
        const prevCoarse = granularToCoarse(status);

        let cancelParty = pl.cancelParty as string | undefined;
        if (
          cancelParty !== 'client' &&
          cancelParty !== 'specialist' &&
          cancelParty !== 'system'
        ) {
          cancelParty =
            hinted === 'canceled_by_client' || hinted === 'reject_by_client'
              ? 'client'
              : hinted != null ?
                'specialist'
              : 'specialist';
        }

        if (devOrUnknown) {
          status = hinted!;
        } else if (prevCoarse === 'pending') {
          if (cancelParty === 'client') {
            status = 'reject_by_client';
          } else {
            status = 'reject_by_master';
          }
        } else if (prevCoarse === 'confirmed') {
          if (cancelParty === 'client') {
            status = 'canceled_by_client';
          } else {
            status = 'canceled_by_master';
          }
        } else if (prevCoarse === 'active') {
          if (cancelParty === 'client') {
            status = 'canceled_by_client';
          } else {
            status = 'canceled_by_master';
          }
        } else if (hinted !== null && cancelParty !== 'client') {
          status =
            hinted === 'canceled_by_client' || hinted === 'reject_by_client'
              ? hinted === 'reject_by_client' ? 'reject_by_client'
              : 'canceled_by_client'
            : hinted;
        } else {
          status =
            cancelParty === 'client' ?
              'canceled_by_client'
            : 'canceled_by_master';
        }

        const norm = normalizeCancelTexts({
          reasonCode: typeof pl.reasonCode === 'string' ? pl.reasonCode : null,
          reasonText:
            typeof pl.reasonText === 'string' ?
              pl.reasonText
            : typeof pl.reason === 'string' ? pl.reason
            : null,
          cancellationComment:
            typeof pl.cancellationComment === 'string' ?
              pl.cancellationComment
            : null,
        });
        cancelReason = norm.cancelReason;
        cancellationComment = norm.cancellationComment;
        pendingExpiresAt = null;
        break;
      }
      case 'expired': {
        const pl = p as Record<string, unknown>;
        status = 'expired';
        pendingExpiresAt = null;
        const code =
          typeof pl.reasonCode === 'string' && pl.reasonCode.length > 0 ?
            pl.reasonCode
          : BOOKING_CANCEL_REASON_PENDING_CONFIRMATION_TIMEOUT;
        cancelReason =
          typeof pl.reasonText === 'string' && pl.reasonText.trim().length > 0 ?
            [code, pl.reasonText.trim()].join(' | ')
          : code;
        cancellationComment = null;
        break;
      }
      case 'no_show': {
        const pl = p as { party: 'client' | 'specialist' };
        status =
          pl.party === 'client' ? 'no_show_by_client' : 'no_show_by_master';
        pendingExpiresAt = null;
        break;
      }
      case 'started': {
        status = 'in_progress';
        pendingExpiresAt = null;
        break;
      }
      case 'completed': {
        status = 'done';
        break;
      }
      case 'rescheduled': {
        const pl = p as Record<string, unknown>;
        startsAt = coerceDate(pl.nextStartsAt);
        endsAt = coerceDate(pl.nextEndsAt);
        pendingExpiresAt = null;
        break;
      }
      default: {
        const bad: unknown = raw.type;
        throw new Error(`unknown_booking_event_type:${String(bad)}`);
      }
    }
  }

  const lastEvt = events[events.length - 1];
  if (lastEvt?.type === 'completed') {
    const plCompleted = parseBookingEventPayload(
      'completed',
      lastEvt.payload ?? {},
    ) as { reasonCode?: string | null };
    if (
      plCompleted.reasonCode ===
      BOOKING_COMPLETED_EVENT_REASON_CODE_AUTO_DONE_AT_SLOT_END
    ) {
      cancelReason = null;
      cancellationComment = null;
    }
  }

  return {
    status,
    startsAt,
    endsAt,
    pendingExpiresAt,
    cancelReason,
    cancellationComment,
  };
}

/** Сводка строки `Booking`: проектируемые поля совпадают с {@link BookingRowProjection}. */
export type BookingRowMaterializedSubset = BookingRowProjection;

/** OLTP строка должна совпадать с проекцией журнала до очередного append (иначе чтение статусов и cron небезопасны). */
export function materializedBookingMatchesProjectedRow(
  row: BookingRowMaterializedSubset,
  projected: BookingRowProjection,
): boolean {
  const pa = row.pendingExpiresAt?.getTime() ?? null;
  const pb = projected.pendingExpiresAt?.getTime() ?? null;
  return (
    row.status === projected.status &&
    row.startsAt.getTime() === projected.startsAt.getTime() &&
    row.endsAt.getTime() === projected.endsAt.getTime() &&
    pa === pb &&
    (row.cancelReason ?? null) === (projected.cancelReason ?? null) &&
    (row.cancellationComment ?? null) === (projected.cancellationComment ?? null)
  );
}
