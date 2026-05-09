import type { BookingActorKind, BookingEventType, Prisma } from '@prisma/client';

export const BOOKING_HISTORY_ACTOR_CLIENT: BookingActorKind = 'client';
export const BOOKING_HISTORY_ACTOR_SPECIALIST: BookingActorKind = 'specialist';
export const BOOKING_HISTORY_ACTOR_STAFF: BookingActorKind = 'staff';
export const BOOKING_HISTORY_ACTOR_SYSTEM: BookingActorKind = 'system';

export function inferBookingEventActorKind(args: {
  actorUserId: string | null;
  clientUserId?: string | null;
  specialistUserId?: string | null;
}): BookingActorKind {
  if (args.actorUserId == null) {
    return BOOKING_HISTORY_ACTOR_SYSTEM;
  }
  if (args.clientUserId != null && args.actorUserId === args.clientUserId) {
    return BOOKING_HISTORY_ACTOR_CLIENT;
  }
  if (
    args.specialistUserId != null &&
    args.actorUserId === args.specialistUserId
  ) {
    return BOOKING_HISTORY_ACTOR_SPECIALIST;
  }
  return BOOKING_HISTORY_ACTOR_STAFF;
}

export type AppendBookingEventInput = {
  bookingId: string;
  type: BookingEventType;
  actorUserId: string | null;
  /** Явный актор вместо вывода по userId (dev/system и т.п.). */
  actorKindOverride?: BookingActorKind | null;
  /** Стабильный ключ повторяемого append (тот же ключ при BOOKING_BUSY_RETRY / сетевом retry). */
  idempotencyKey?: string | null;
  payload: unknown | null;
  /** Системное исключение: `confirmed`/`in_progress` → отмена мастером/организацией (смена места работы и т.п.). */
  allowMassOrgSpecialistCancel?: boolean;
};

export type PrismaBookingEventCreate = Prisma.BookingEventUncheckedCreateInput;
