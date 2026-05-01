import { z } from 'zod';
import { requestLocaleQuerySchema } from '../../../common/i18n/request-locale-query.schema';

export const salonCabinetBookingsListQuerySchema = z
  .object({
    scope: z.enum(['managed', 'active_workplace']),
  })
  .merge(requestLocaleQuerySchema);

export type SalonCabinetBookingsListQuery = z.infer<
  typeof salonCabinetBookingsListQuerySchema
>;
