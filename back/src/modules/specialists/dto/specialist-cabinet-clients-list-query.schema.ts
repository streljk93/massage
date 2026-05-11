import { z } from 'zod';
import { requestLocaleQuerySchema } from '../../../common/i18n/request-locale-query.schema';

export const SPECIALIST_CABINET_CLIENTS_SORT_VALUES = [
  'lastBookingDesc',
  'nameAsc',
  'visitsDesc',
] as const;

export const specialistCabinetClientsListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    sort: z
      .enum(SPECIALIST_CABINET_CLIENTS_SORT_VALUES)
      .default('lastBookingDesc'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().regex(/^\d+$/).optional(),
  })
  .merge(requestLocaleQuerySchema);

export type SpecialistCabinetClientsListQuery = z.infer<
  typeof specialistCabinetClientsListQuerySchema
>;
