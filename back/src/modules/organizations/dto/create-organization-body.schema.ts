import { z } from 'zod';

function trimmedOrNull(v: string | null | undefined): string | null {
  if (v == null) {
    return null;
  }
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

const placeReferenceBodySchema = z
  .object({
    provider: z.enum(['locationiq', 'geoapify', 'opencage', 'nominatim']),
    placeId: z.string().min(1).max(400).trim(),
  })
  .strict();

export const createOrganizationBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    /**
     * Ссылка на объект геокодера (аудит / повторный resolve при необходимости).
     * Если вместе с ней переданы `latitude`, `longitude` и непустой `addressLine` —
     * координаты и строка адреса сохраняются с клиента (точка с карты кабинета), без `resolveByPlaceId`.
     * Иначе сервер заполняет адрес через `resolveToCanonical(placeReference)` (устар. режим).
     */
    placeReference: placeReferenceBodySchema.optional(),
    addressLine: z.string().min(1).max(500).trim().optional(),
    /// Локалитет (при ручном пути или дублирует вывод геокодера).
    city: z.string().max(120).trim().optional().nullable(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    description: z.string().max(4000).optional(),
    /** Вьетнам E.164: `+84` и 8–12 цифр национальной части (как у профиля мастера). Пусто/null — нет телефона салона. */
    phone: z.string().max(32).optional().nullable(),
    email: z.string().max(254).optional().nullable(),
    website: z.string().max(2048).optional().nullable(),
    yearsInBusiness: z.number().int().min(0).max(80).optional().nullable(),
    imageUrl: z.string().min(1).max(2048).optional().nullable(),
    imageAlt: z.string().max(500).optional().nullable(),
    /** Дополнительные фото витрины (первая «обложка» — `imageUrl`, если задан, иначе первый URL здесь). */
    galleryImageUrls: z.array(z.string().min(1).max(2048)).max(24).optional(),
    /** Подкатегории витрины (каталог) — не меньше одной, все должны существовать и быть активны. */
    serviceCategoryIds: z.array(z.string().uuid()).min(1).max(40),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.placeReference) {
      const lat = data.latitude;
      const lng = data.longitude;
      const hasBothCoords = lat != null && lng != null;
      const hasPartialCoords =
        (lat != null && lng == null) || (lat == null && lng != null);
      if (hasPartialCoords) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'latitude and longitude must be set together',
          path: ['latitude'],
        });
      }
      if (hasBothCoords) {
        const line = data.addressLine?.trim() ?? '';
        if (line.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'addressLine is required when saving coordinates from map picker',
            path: ['addressLine'],
          });
        }
      }
      return;
    }
    if (
      data.addressLine == null ||
      data.latitude == null ||
      data.longitude == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Either placeReference or addressLine with latitude and longitude',
        path: ['addressLine'],
      });
    }
  })
  .superRefine((data, ctx) => {
    const phone =
      data.phone == null ? '' : String(data.phone).trim().replace(/\s/g, '');
    if (phone.length > 0 && !/^\+84\d{8,12}$/.test(phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'phone must be Vietnam E.164 (+84 and 8–12 national digits) or empty',
        path: ['phone'],
      });
    }
    const email = trimmedOrNull(data.email);
    if (email != null && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid email',
        path: ['email'],
      });
    }
    const website = trimmedOrNull(data.website);
    if (website != null) {
      const withScheme = /^https?:\/\//i.test(website)
        ? website
        : `https://${website}`;
      try {
        const u = new URL(withScheme);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          throw new Error('protocol');
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid website URL',
          path: ['website'],
        });
      }
    }
  })
  .transform((data) => {
    const phoneRaw =
      data.phone == null ? null : String(data.phone).trim().replace(/\s/g, '');
    const phone = phoneRaw && phoneRaw.length > 0 ? phoneRaw : null;
    const email = trimmedOrNull(data.email)?.toLowerCase() ?? null;
    const webRaw = trimmedOrNull(data.website);
    const website =
      webRaw == null
        ? null
        : /^https?:\/\//i.test(webRaw)
          ? webRaw
          : `https://${webRaw}`;
    return {
      ...data,
      phone,
      email,
      website,
    };
  });

export type CreateOrganizationBody = z.infer<
  typeof createOrganizationBodySchema
>;
