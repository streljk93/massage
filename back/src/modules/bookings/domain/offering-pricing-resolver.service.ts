import { Injectable } from '@nestjs/common';
import {
  OfferingPriceOptionStatus,
  type OfferingPriceOption,
  type SpecialistOfferingPriceOverride,
} from '@prisma/client';

/** Единственное место правила §3.2.2: list price опции ± override мастера; без canonical effective-колонки OLTP. */
@Injectable()
export class OfferingPricingResolver {
  /**
   * Возвращает цену и длительность для брони по выбранной опции оффера.
   * @throws Error с `.name === 'OfferingPricingResolverError'` и полем `code` для маппинга в HTTP
   */
  resolve(args: {
    priceOption: Pick<
      OfferingPriceOption,
      'durationMinutes' | 'priceAmount' | 'currency' | 'status' | 'deletedAt'
    >;
    override?: Pick<
      SpecialistOfferingPriceOverride,
      'customPrice'
    > | null;
  }): {
    priceAmount: number;
    currency: string;
    durationMinutes: number;
  } {
    const opt = args.priceOption;
    if (opt.deletedAt != null) {
      throw this.err('OFFERING_PRICE_OPTION_UNAVAILABLE', 'Option is removed');
    }
    if (opt.status !== OfferingPriceOptionStatus.active) {
      throw this.err(
        'OFFERING_PRICE_OPTION_UNAVAILABLE',
        'Option is not available for booking',
      );
    }
    const currency = (opt.currency ?? 'VND').toUpperCase();
    if (currency !== 'VND') {
      throw this.err(
        'OFFERING_PRICE_OPTION_CURRENCY_UNSUPPORTED',
        'Only VND options are supported for booking',
      );
    }
    const base = opt.priceAmount;
    if (!Number.isFinite(base) || base < 0) {
      throw this.err('OFFERING_PRICE_INVALID', 'Invalid list price');
    }
    const o = args.override;
    const priceAmount =
      o != null ?
        o.customPrice
      : base;
    if (!Number.isFinite(priceAmount) || priceAmount < 0) {
      throw this.err('OFFERING_PRICE_INVALID', 'Invalid resolved price');
    }
    return {
      priceAmount,
      currency: opt.currency ?? 'VND',
      durationMinutes: opt.durationMinutes,
    };
  }

  private err(code: string, message: string): Error {
    const e = new Error(message);
    e.name = 'OfferingPricingResolverError';
    (e as Error & { code: string }).code = code;
    return e;
  }
}

export function isOfferingPricingResolverError(
  e: unknown,
): e is Error & { code: string } {
  return (
    e instanceof Error &&
    e.name === 'OfferingPricingResolverError' &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
  );
}
