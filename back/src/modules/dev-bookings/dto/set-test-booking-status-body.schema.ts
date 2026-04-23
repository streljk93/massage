import { z } from 'zod';
import { DEV_BOOKING_STATUS_ENUM_VALUES } from './dev-booking-status.constants';

export const setTestBookingStatusBodySchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(DEV_BOOKING_STATUS_ENUM_VALUES),
  /** Попадает в `BookingStatusHistory.reason` (и опционально в комментарий отмены). */
  reason: z.string().max(500).optional(),
  cancelReason: z.string().max(200).optional(),
  cancellationComment: z.string().max(1000).optional(),
});

export type SetTestBookingStatusBody = z.infer<
  typeof setTestBookingStatusBodySchema
>;
