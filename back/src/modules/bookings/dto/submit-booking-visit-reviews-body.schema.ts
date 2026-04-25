import { z } from 'zod';

const ratingField = z.coerce
  .number()
  .int('Rating must be an integer')
  .min(1, 'Minimum rating is 1')
  .max(5, 'Maximum rating is 5');

const optionalComment = z
  .union([z.string().max(2000), z.null(), z.undefined()])
  .transform((s) => {
    if (s == null || s === '') {
      return undefined;
    }
    return s.trim();
  });

/**
 * Клиент оставляет **два** отзыва с одной визитной карточки: салон и мастер
 * (разные сущности в БД).
 */
export const submitBookingVisitReviewsBodySchema = z.object({
  organizationRating: ratingField,
  specialistRating: ratingField,
  organizationComment: optionalComment,
  specialistComment: optionalComment,
});

export type SubmitBookingVisitReviewsBody = z.infer<
  typeof submitBookingVisitReviewsBodySchema
>;
