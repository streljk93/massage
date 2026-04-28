import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AddressProviderId } from '../domain/address-providers.const';
import type { CanonicalAddress } from '../domain/canonical-address.model';
import type {
  AddressProviderResolveOptions,
  AddressSearchProviderPort,
} from '../domain/address-search-provider.port';
import type { AddressSuggestionItem } from '../domain/address-suggestion.model';
import { pickCityFromOsmStyleAddress } from './address-osm-locality.util';
import { fetchWithTimeout, isFallbackHttpStatus } from './address-http.util';

const MIN_CONFIDENCE = 4;
const OC_PLACE = /^oc\|([+-]?\d+(?:\.\d+)?)\|([+-]?\d+(?:\.\d+)?)$/;

/**
 * OpenCage Geocoding, см. https://opencagedata.com/api
 */
@Injectable()
export class OpenCageAddressHttpService implements AddressSearchProviderPort {
  private readonly log = new Logger(OpenCageAddressHttpService.name);
  readonly providerId: AddressProviderId = 'opencage';
  private readonly base = 'https://api.opencagedata.com/geocode/v1/json';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.getKey().length > 0;
  }

  private getKey(): string {
    return this.config.get<string>('address.opencage.apiKey', '')?.trim() ?? '';
  }

  private encodeFromCoords(lat: number, lon: number): string {
    return `oc|${lat.toFixed(6)}|${lon.toFixed(6)}`;
  }

  private parseCoords(placeId: string): { lat: number; lon: number } {
    const m = placeId.trim().match(OC_PLACE);
    if (!m) {
      throw new BadRequestException({
        code: 'ADDRESS_OC_BAD_PLACE',
        message: 'Invalid OpenCage place id',
      });
    }
    return { lat: Number(m[1]), lon: Number(m[2]) };
  }

  async getSuggestions(
    query: string,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<readonly AddressSuggestionItem[]> {
    const key = this.getKey();
    if (!key) {
      return [];
    }
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const u = new URL(this.base);
    u.searchParams.set('q', q);
    u.searchParams.set('key', key);
    u.searchParams.set('limit', '5');
    u.searchParams.set('no_annotations', '0');
    let res: Response;
    try {
      res = await fetchWithTimeout(
        u.toString(),
        { method: 'GET' },
        requestTimeoutMs,
      );
    } catch {
      return [];
    }
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status)) {
        this.log.debug(`geocode http ${res.status}`);
      } else {
        this.log.warn(`geocode http ${res.status}`);
      }
      return [];
    }
    const data = (await res.json()) as {
      results?: {
        confidence?: number;
        geometry?: { lat: number; lng: number };
        formatted?: string;
        components?: Record<string, string>;
      }[];
    };
    const out: AddressSuggestionItem[] = [];
    for (const r of data.results ?? []) {
      if (
        r.confidence != null &&
        Number.isFinite(r.confidence) &&
        r.confidence < MIN_CONFIDENCE
      ) {
        continue;
      }
      const g = r.geometry;
      if (g == null) {
        continue;
      }
      const lat = g.lat;
      const lon = g.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }
      const line = (r.formatted ?? '').trim();
      if (line.length < 2) {
        continue;
      }
      const c = r.components;
      const main =
        c?.neighbourhood ||
        c?.suburb ||
        c?.village ||
        c?.city ||
        c?.town ||
        line.split(',')[0]?.trim() ||
        line;
      const placeId = this.encodeFromCoords(lat, lon);
      out.push({
        placeId,
        mainText: main.slice(0, 120),
        secondaryText: line.slice(0, 200),
        provider: this.providerId,
        resolved: {
          addressLine: line.slice(0, 500),
          city: pickCityFromOsmStyleAddress(c),
          latitude: lat,
          longitude: lon,
          sourceProvider: this.providerId,
          sourceReference: placeId,
        },
      });
    }
    return out;
  }

  async reverseFromCoordinates(
    latitude: number,
    longitude: number,
    options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<CanonicalAddress> {
    return this.resolveByPlaceId(
      this.encodeFromCoords(latitude, longitude),
      options,
      requestTimeoutMs,
    );
  }

  async resolveByPlaceId(
    placeId: string,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<CanonicalAddress> {
    const key = this.getKey();
    if (!key) {
      throw new BadRequestException({
        code: 'ADDRESS_OC_KEY',
        message: 'OpenCage is not configured',
      });
    }
    const { lat, lon } = this.parseCoords(placeId);
    const u = new URL(this.base);
    u.searchParams.set('q', `${lat} ${lon}`);
    u.searchParams.set('key', key);
    u.searchParams.set('limit', '1');
    const res = await fetchWithTimeout(
      u.toString(),
      { method: 'GET' },
      requestTimeoutMs,
    );
    if (!res.ok) {
      if (isFallbackHttpStatus(res.status) || res.status === 404) {
        throw new BadRequestException({
          code: 'ADDRESS_PLACE_UNREACHABLE',
          message: 'OpenCage resolve failed',
        });
      }
      throw new Error(`opencage http ${res.status}`);
    }
    const data = (await res.json()) as {
      results?: {
        formatted: string;
        components?: Record<string, string>;
        confidence?: number;
        geometry?: { lat: number; lng: number };
      }[];
    };
    const r = data.results?.[0];
    if (!r?.formatted || !r.geometry) {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_NOT_FOUND',
        message: 'Place not found',
      });
    }
    if (
      r.confidence != null &&
      Number.isFinite(r.confidence) &&
      r.confidence < MIN_CONFIDENCE
    ) {
      throw new BadRequestException({
        code: 'ADDRESS_POOR_CONFIDENCE',
        message: 'Geocode confidence too low',
      });
    }
    const g = r.geometry;
    return {
      addressLine: r.formatted.slice(0, 500),
      city: pickCityFromOsmStyleAddress(r.components),
      latitude: g.lat,
      longitude: g.lng,
      sourceProvider: this.providerId,
      sourceReference: placeId.trim(),
    };
  }
}
