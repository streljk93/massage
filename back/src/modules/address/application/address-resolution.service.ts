import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ApiLocale } from '../../../common/i18n/api-locale';
import type { CanonicalAddress } from '../domain/canonical-address.model';
import type { AddressSuggestionItem } from '../domain/address-suggestion.model';
import { UpstreamAddressTimeoutError } from '../infrastructure/address-http.util';
import { AddressProviderRegistry } from '../infrastructure/address-provider-registry.service';

/**
 * Публичный API модуля адресов для других доменов (онбординг, формы).
 * Подсказки: цепочка провайдеров (таймаут / 5xx / 429 / пусто → следующий).
 * Resolve: только выбранный `provider` + `placeId` (id не переносится между API).
 */
@Injectable()
export class AddressResolutionService {
  private readonly log = new Logger(AddressResolutionService.name);

  constructor(private readonly registry: AddressProviderRegistry) {}

  private shouldTryNextProviderForSuggestions(err: unknown): boolean {
    if (err instanceof UpstreamAddressTimeoutError) {
      return true;
    }
    if (err instanceof BadRequestException) {
      return false;
    }
    return true;
  }

  async searchSuggestions(
    query: string,
    options?: { locale?: ApiLocale },
  ): Promise<AddressSuggestionItem[]> {
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const providers = this.registry.getOrderedActiveProviders();
    if (providers.length === 0) {
      throw new ServiceUnavailableException({
        code: 'ADDRESS_NOT_CONFIGURED',
        message:
          'No address search provider is configured. Set keys in .env (see back/.env.example).',
      });
    }
    const requestTimeoutMs = this.registry.requestTimeoutMs();
    for (const p of providers) {
      try {
        const items = await p.getSuggestions(
          q,
          { locale: options?.locale },
          requestTimeoutMs,
        );
        if (items.length > 0) {
          return [...items];
        }
      } catch (e) {
        if (this.shouldTryNextProviderForSuggestions(e)) {
          this.log.warn(
            `suggestions: provider ${p.providerId} skipped: ${e instanceof Error ? e.message : e}`,
          );
          continue;
        }
        throw e;
      }
    }
    return [];
  }

  async reverseToCanonical(
    latitude: number,
    longitude: number,
    options?: { locale?: ApiLocale },
  ): Promise<CanonicalAddress> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException({
        code: 'ADDRESS_COORDS_INVALID',
        message: 'Invalid coordinates',
      });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException({
        code: 'ADDRESS_COORDS_OUT_OF_RANGE',
        message: 'Coordinates out of range',
      });
    }
    const providers = this.registry.getOrderedActiveProviders();
    if (providers.length === 0) {
      throw new ServiceUnavailableException({
        code: 'ADDRESS_NOT_CONFIGURED',
        message:
          'No address search provider is configured. Set keys in .env (see back/.env.example).',
      });
    }
    const requestTimeoutMs = this.registry.requestTimeoutMs();
    let lastBad: BadRequestException | null = null;
    for (const p of providers) {
      try {
        return await p.reverseFromCoordinates(
          latitude,
          longitude,
          { locale: options?.locale },
          requestTimeoutMs,
        );
      } catch (e) {
        if (e instanceof BadRequestException) {
          lastBad = e;
          this.log.warn(
            `reverse: provider ${p.providerId} skipped: ${e.message}`,
          );
          continue;
        }
        if (this.shouldTryNextProviderForSuggestions(e)) {
          this.log.warn(
            `reverse: provider ${p.providerId} skipped: ${
              e instanceof Error ? e.message : e
            }`,
          );
          continue;
        }
        throw e;
      }
    }
    throw (
      lastBad ??
      new BadRequestException({
        code: 'ADDRESS_REVERSE_NOT_FOUND',
        message: 'Could not resolve address for coordinates',
      })
    );
  }

  async resolveToCanonical(
    providerId: string,
    placeId: string,
    options?: { locale?: ApiLocale },
  ): Promise<CanonicalAddress> {
    const p = this.registry.getProviderById(providerId);
    if (p == null) {
      throw new BadRequestException({
        code: 'ADDRESS_UNKNOWN_PROVIDER',
        message: 'Unknown address provider',
      });
    }
    if (!p.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'ADDRESS_NOT_CONFIGURED',
        message: 'Address provider is not configured',
      });
    }
    const ref = placeId.trim();
    if (ref.length < 1) {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_ID_EMPTY',
        message: 'placeId is required',
      });
    }
    const requestTimeoutMs = this.registry.requestTimeoutMs();
    return p.resolveByPlaceId(ref, { locale: options?.locale }, requestTimeoutMs);
  }
}
