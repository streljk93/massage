import { OfferingPriceOptionStatus } from '@prisma/client';

/** Дефолтные VND-опции для автозаполнения прайса по подкатегории каталога (онбординг / сид). */
export const DEFAULT_ORG_OFFERING_VND_PRICE_OPTIONS = [
  {
    durationMinutes: 60,
    priceAmount: 400_000,
    currency: 'VND',
    status: OfferingPriceOptionStatus.active,
  },
  {
    durationMinutes: 90,
    priceAmount: 550_000,
    currency: 'VND',
    status: OfferingPriceOptionStatus.active,
  },
] as const;
