import type { BookingEventType } from '@prisma/client';
import type { BookingCoarseState } from './booking-state.types';

/** Минимальные поля для reducer-а упорядоченного журнала. */
export type BookingEventLike = {
  type: BookingEventType;
};

/**
 * Сводное состояние по журналу (для допусков следующего события).
 * Порядок событий: `localSequence ASC`, затем `id ASC` (как при чтении журнала в append).
 */
export function reduceBookingCoarseState(events: BookingEventLike[]): BookingCoarseState {
  let state: BookingCoarseState = null;
  for (const e of events) {
    switch (e.type) {
      case 'created':
        state = 'pending';
        break;
      case 'confirmed':
        state = 'confirmed';
        break;
      case 'started':
        state = 'active';
        break;
      case 'completed':
        state = 'completed';
        break;
      case 'rejected':
        state = 'rejected';
        break;
      case 'canceled':
        state = 'canceled';
        break;
      case 'expired':
        state = 'expired';
        break;
      case 'no_show':
        state = 'no_show';
        break;
      case 'rescheduled':
        break;
      default: {
        const _never: never = e.type;
        return _never;
      }
    }
  }
  return state;
}
