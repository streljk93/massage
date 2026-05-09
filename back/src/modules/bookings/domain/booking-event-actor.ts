import type { BookingEventType, Prisma } from '@prisma/client';

/** Стабильные значения `BookingEvent.actorKind` для BI/API. */
export const BOOKING_HISTORY_ACTOR_CLIENT = 'client';
export const BOOKING_HISTORY_ACTOR_SPECIALIST = 'specialist';
export const BOOKING_HISTORY_ACTOR_STAFF = 'staff';
export const BOOKING_HISTORY_ACTOR_SYSTEM = 'system';

export function inferBookingEventActorKind(args: {
  actorUserId: string | null;
  clientUserId?: string | null;
  specialistUserId?: string | null;
}): string {
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
  actorKindOverride?: string | null;
  payload: unknown | null;
  /** Системное исключение: `confirmed`/`in_progress` → отмена мастером/организацией (смена места работы и т.п.). */
  allowMassOrgSpecialistCancel?: boolean;
};

export type PrismaBookingEventCreate = Prisma.BookingEventUncheckedCreateInput;
