import { z } from 'zod';

const phoneSchema = z.string().min(1).max(32);

const specialistOnboardingMassageBodySchema = z
  .object({
    pressureLevel: z.number().int().min(1).max(5).optional(),
    pressureAdaptsToClient: z.boolean().optional(),
  })
  .strict();

export const patchSpecialistOnboardingProfileBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.union([phoneSchema, z.null()]).optional(),
  bio: z.string().min(1).max(4000).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  imageUrl: z.string().min(1).max(2048).nullable().optional(),
  imageAlt: z.string().min(1).max(500).nullable().optional(),
  /** Параметры вертикали «массаж»; для стоматологии и т.д. — отдельные блоки. */
  massage: specialistOnboardingMassageBodySchema.optional(),
});

export type PatchSpecialistOnboardingProfileBody = z.infer<
  typeof patchSpecialistOnboardingProfileBodySchema
>;

export const createSpecialistPersonalServiceBodySchema = z
  .object({
    categoryId: z.string().uuid(),
    description: z.string().max(4000).optional(),
    priceOptions: z
      .array(
        z.object({
          durationMinutes: z.number().int().min(15).max(1440),
          priceAmount: z.number().int().min(1),
          currency: z.string().min(3).max(3).optional(),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();

export type CreateSpecialistPersonalServiceBody = z.infer<
  typeof createSpecialistPersonalServiceBodySchema
>;

export const joinOnboardingOrganizationBodySchema = z
  .object({
    organizationId: z.string().uuid(),
  })
  .strict();

export type JoinOnboardingOrganizationBody = z.infer<
  typeof joinOnboardingOrganizationBodySchema
>;

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

export const createOnboardingOrganizationBodySchema = z
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

export type CreateOnboardingOrganizationBody = z.infer<
  typeof createOnboardingOrganizationBodySchema
>;
