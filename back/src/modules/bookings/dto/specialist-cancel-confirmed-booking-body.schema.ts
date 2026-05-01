import { z } from 'zod';
import { BOOKING_MASTER_CANCEL_REASON_CODES } from '../domain/booking-master-cancel-reasons';

const reasonEnum = z.enum(
  BOOKING_MASTER_CANCEL_REASON_CODES as unknown as [
    (typeof BOOKING_MASTER_CANCEL_REASON_CODES)[number],
    ...(typeof BOOKING_MASTER_CANCEL_REASON_CODES)[number][],
  ],
);

/**
 * Тело `POST /bookings/me/:id/cancel` — только для `confirmed` → `canceled_by_master`.
 * При `master_other` — непустой `cancellationComment`.
 */
export const specialistCancelConfirmedBookingBodySchema = z
  .object({
    cancelReason: reasonEnum,
    cancellationComment: z.string().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.cancelReason !== 'master_other') {
      return;
    }
    if ((v.cancellationComment ?? '').trim().length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cancellationComment'],
        message:
          'cancellationComment is required when cancelReason is master_other',
      });
    }
  });

export type SpecialistCancelConfirmedBookingBody = z.infer<
  typeof specialistCancelConfirmedBookingBodySchema
>;
