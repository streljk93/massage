import {
  OfferingPriceOptionStatus,
  type OfferingPriceOption,
  type SpecialistOfferingPriceOverride,
} from '@prisma/client';
import {
  OfferingPricingResolver,
  isOfferingPricingResolverError,
} from './offering-pricing-resolver.service';

function opt(
  partial: Partial<OfferingPriceOption> &
    Pick<OfferingPriceOption, 'durationMinutes' | 'priceAmount'>,
): Pick<
  OfferingPriceOption,
  'durationMinutes' | 'priceAmount' | 'currency' | 'status' | 'deletedAt'
> {
  return {
    durationMinutes: partial.durationMinutes,
    priceAmount: partial.priceAmount,
    currency: partial.currency ?? 'VND',
    status: partial.status ?? OfferingPriceOptionStatus.active,
    deletedAt: partial.deletedAt ?? null,
  };
}

describe('OfferingPricingResolver', () => {
  const resolver = new OfferingPricingResolver();

  it('returns list price without override', () => {
    expect(
      resolver.resolve({
        priceOption: opt({ durationMinutes: 60, priceAmount: 500_000 }),
        override: null,
      }),
    ).toEqual({
      priceAmount: 500_000,
      currency: 'VND',
      durationMinutes: 60,
    });
  });

  it('returns customPrice when override present', () => {
    expect(
      resolver.resolve({
        priceOption: opt({ durationMinutes: 90, priceAmount: 400_000 }),
        override: { customPrice: 350_000 } as SpecialistOfferingPriceOverride,
      }),
    ).toEqual({
      priceAmount: 350_000,
      currency: 'VND',
      durationMinutes: 90,
    });
  });

  it('throws when option deleted', () => {
    let caught: unknown;
    try {
      resolver.resolve({
        priceOption: opt({
          durationMinutes: 60,
          priceAmount: 1,
          deletedAt: new Date(),
        }),
        override: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(isOfferingPricingResolverError(caught)).toBe(true);
    expect((caught as Error & { code: string }).code).toBe(
      'OFFERING_PRICE_OPTION_UNAVAILABLE',
    );
  });

  it('throws when option status not active', () => {
    let caught: unknown;
    try {
      resolver.resolve({
        priceOption: opt({
          durationMinutes: 60,
          priceAmount: 1,
          status: OfferingPriceOptionStatus.hidden,
        }),
        override: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(isOfferingPricingResolverError(caught)).toBe(true);
    expect((caught as Error & { code: string }).code).toBe(
      'OFFERING_PRICE_OPTION_UNAVAILABLE',
    );
  });

  it('throws on non-VND currency', () => {
    let caught: unknown;
    try {
      resolver.resolve({
        priceOption: opt({
          durationMinutes: 60,
          priceAmount: 10,
          currency: 'USD',
        }),
        override: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(isOfferingPricingResolverError(caught)).toBe(true);
    expect((caught as Error & { code: string }).code).toBe(
      'OFFERING_PRICE_OPTION_CURRENCY_UNSUPPORTED',
    );
  });

});
