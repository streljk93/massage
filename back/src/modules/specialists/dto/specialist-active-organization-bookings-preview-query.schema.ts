import { z } from 'zod';
import { requestLocaleQuerySchema } from '../../../common/i18n/request-locale-query.schema';

export const specialistActiveOrganizationBookingsPreviewQuerySchema = z
  .object({
    organizationId: z.string().uuid(),
  })
  .merge(requestLocaleQuerySchema);

export type SpecialistActiveOrganizationBookingsPreviewQuery = z.infer<
  typeof specialistActiveOrganizationBookingsPreviewQuerySchema
>;
