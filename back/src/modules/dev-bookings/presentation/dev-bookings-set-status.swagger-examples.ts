import {
  BOOKING_STATUS_ALL_ORDERED,
  BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS,
} from '../../bookings/domain/booking-status-all-ordered';

const PLACEHOLDER_BOOKING_ID = '22222222-2222-4222-8222-222222222222';

function buildExampleValue(
  status: (typeof BOOKING_STATUS_ALL_ORDERED)[number],
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    bookingId: PLACEHOLDER_BOOKING_ID,
    status,
    reason: `dev: установить ${status}`,
  };

  if (status === 'canceled_by_master' || status === 'canceled_by_client') {
    base.cancelReason = 'dev_reason';
    base.cancellationComment = 'dev: комментарий отмены';
  }

  if (status === 'reject_by_master' || status === 'reject_by_client') {
    base.cancelReason = 'dev_reject';
  }

  if (status === 'expired') {
    base.cancelReason = 'pending_confirmation_timeout';
  }

  return base;
}

/**
 * По одному примеру на каждый `BookingStatus` — выпадающий список «Examples» в Swagger UI.
 */
export const devBookingsSetStatusSwaggerExamples = Object.fromEntries(
  BOOKING_STATUS_ALL_ORDERED.map((status, i) => [
    status,
    {
      summary: status,
      description: BOOKING_STATUS_SWAGGER_ENUM_DESCRIPTIONS[i],
      value: buildExampleValue(status),
    },
  ]),
);
