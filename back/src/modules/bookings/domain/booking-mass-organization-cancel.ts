import { BookingEventType, type BookingStatus } from '@prisma/client';

import type { AppendBookingEventInput } from './booking-event-actor';
import {
  BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN,
  BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN,
} from './booking-cancel-reason';

type MassCancelTexts = {
  cancelReason?: string | null;
  cancellationComment?: string | null;
};

function resolvedMassCancelTexts(
  masterLeftWorkplace: boolean,
  texts: MassCancelTexts,
): { cancelReason: string; cancellationComment: string | null } {
  const cc =
    typeof texts.cancellationComment === 'string' &&
    texts.cancellationComment.trim().length > 0 ?
      texts.cancellationComment.trim()
    : null;
  const canonical =
    masterLeftWorkplace ?
      BOOKING_AUTO_CANCEL_MASTER_LEFT_WORKPLACE_EN
    : BOOKING_CANCEL_REASON_ORGANIZATION_DELETED_EN;
  const cr =
    typeof texts.cancelReason === 'string' && texts.cancelReason.trim().length > 0 ?
      texts.cancelReason.trim()
    : canonical;
  return { cancelReason: cr, cancellationComment: cc };
}

/** Массовая отмена при смене места работы / удалении организации. */
export function appendInputMassOrganizationCancelBooking(args: {
  bookingId: string;
  granularStatus: BookingStatus;
  actorUserId: string;
  texts: MassCancelTexts;
  masterLeftWorkplace: boolean;
}): AppendBookingEventInput {
  const resolved = resolvedMassCancelTexts(args.masterLeftWorkplace, args.texts);
  const reasonTextCombined = [
    resolved.cancelReason,
    resolved.cancellationComment ?? '',
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(' | ');

  if (args.granularStatus === 'pending') {
    return {
      bookingId: args.bookingId,
      type: BookingEventType.rejected,
      actorUserId: args.actorUserId,
      payload: {
        rejectParty: 'specialist',
        massOrganizationAction: true,
        reasonText: reasonTextCombined || resolved.cancelReason,
        cancellationComment: resolved.cancellationComment ?? undefined,
      },
    };
  }

  return {
    bookingId: args.bookingId,
    type: BookingEventType.canceled,
    actorUserId: args.actorUserId,
    allowMassOrgSpecialistCancel: args.granularStatus === 'in_progress',
    payload: {
      cancelParty: 'specialist',
      massOrganizationAction: true,
      reasonText: reasonTextCombined || resolved.cancelReason,
      cancellationComment: resolved.cancellationComment ?? undefined,
    },
  };
}
