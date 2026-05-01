import { z } from 'zod';
import { requestLocaleQueryFieldSchema } from '../../../common/i18n';

export const addressSuggestionsQuerySchema = z
  .object({
    query: z.string().min(2).max(200).trim(),
    locale: requestLocaleQueryFieldSchema.optional(),
  })
  .strict();

export type AddressSuggestionsQuery = z.infer<
  typeof addressSuggestionsQuerySchema
>;

const addressProviderIdSchema = z.enum([
  'locationiq',
  'geoapify',
  'opencage',
  'nominatim',
]);

export const addressResolveBodySchema = z
  .object({
    provider: addressProviderIdSchema,
    placeId: z.string().min(1).max(500).trim(),
  })
  .strict();

export type AddressResolveBody = z.infer<typeof addressResolveBodySchema>;

export const addressReverseBodySchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export type AddressReverseBody = z.infer<typeof addressReverseBodySchema>;
