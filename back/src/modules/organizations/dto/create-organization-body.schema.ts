import { z } from 'zod';

const placeReferenceBodySchema = z
  .object({
    provider: z.enum([
      'locationiq',
      'geoapify',
      'opencage',
      'nominatim',
    ]),
    placeId: z.string().min(1).max(400).trim(),
  })
  .strict();

export const createOrganizationBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    /**
     * Предпочтительно: разрешение на сервере через `AddressModule` (без доверия lat/lng с клиента).
     * Если задано — поля `addressLine` / `latitude` / `longitude` не требуются.
     */
    placeReference: placeReferenceBodySchema.optional(),
    addressLine: z.string().min(1).max(500).trim().optional(),
    /// Локалитет (при ручном пути или дублирует вывод геокодера).
    city: z.string().max(120).trim().optional().nullable(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    description: z.string().max(4000).optional(),
    phone: z.string().max(32).optional().nullable(),
    email: z.string().max(254).optional().nullable(),
    website: z.string().max(2048).optional().nullable(),
    yearsInBusiness: z.number().int().min(0).max(80).optional().nullable(),
    imageUrl: z.string().min(1).max(2048).optional().nullable(),
    imageAlt: z.string().max(500).optional().nullable(),
    /** Подкатегории витрины (каталог) — не меньше одной, все должны существовать и быть активны. */
    serviceCategoryIds: z.array(z.string().uuid()).min(1).max(40),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.placeReference) {
      return;
    }
    if (
      data.addressLine == null ||
      data.latitude == null ||
      data.longitude == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either placeReference or addressLine with latitude and longitude',
        path: ['addressLine'],
      });
    }
  });

export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
