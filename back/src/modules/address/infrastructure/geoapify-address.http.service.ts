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

const MIN_CONFIDENCE_CITY = 0.2;
const GFY_PLACE = /^gfy\|([+-]?\d+(?:\.\d+)?)\|([+-]?\d+(?:\.\d+)?)$/;

/**
 * Geoapify Geocoding / Autocomplete, см. https://apidocs.geoapify.com/
 * `placeId`: `gfy|lat|lon` (как в подсказке) → reverse geocode.
 */
@Injectable()
export class GeoapifyAddressHttpService implements AddressSearchProviderPort {
  private readonly log = new Logger(GeoapifyAddressHttpService.name);
  readonly providerId: AddressProviderId = 'geoapify';
  private readonly base = 'https://api.geoapify.com/v1';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.getKey().length > 0;
  }

  private getKey(): string {
    return this.config.get<string>('address.geoapify.apiKey', '')?.trim() ?? '';
  }

  private encodeFromCoords(lat: number, lon: number): string {
    return `gfy|${lat.toFixed(6)}|${lon.toFixed(6)}`;
  }

  private parseCoords(placeId: string): { lat: number; lon: number } {
    const m = placeId.trim().match(GFY_PLACE);
    if (!m) {
      throw new BadRequestException({
        code: 'ADDRESS_GF_BAD_PLACE',
        message: 'Invalid Geoapify place id',
      });
    }
    return { lat: Number(m[1]), lon: Number(m[2]) };
  }

  private cityFromProperties(
    c: { city?: string; county?: string; state?: string } | undefined,
  ): string | null {
    if (!c) {
      return null;
    }
    const s = c.city || c.state || c.county;
    return s ? s.slice(0, 120) : null;
  }

  async getSuggestions(
    query: string,
    _options: AddressProviderResolveOptions,
    requestTimeoutMs: number,
  ): Promise<readonly AddressSuggestionItem[]> {
    const apiKey = this.getKey();
    if (!apiKey) {
      return [];
    }
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const u = new URL(`${this.base}/geocode/autocomplete`);
    u.searchParams.set('text', q);
    u.searchParams.set('apiKey', apiKey);
    u.searchParams.set('limit', '5');
    u.searchParams.set('format', 'json');
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
        this.log.debug(`autocomplete http ${res.status}`);
      } else {
        this.log.warn(`autocomplete http ${res.status}`);
      }
      return [];
    }
    const raw = (await res.json()) as unknown;
    const rows: {
      lat?: number;
      lon?: number;
      formatted?: string;
      name?: string;
      rank?: { confidence?: number; importance?: number };
      address_line1?: string;
      address_line2?: string;
      properties?: { city?: string; county?: string; state?: string };
      address?: Record<string, string>;
    }[] = Array.isArray((raw as { results?: unknown }).results)
      ? (raw as { results: typeof rows }).results
      : ((
          raw as {
            features?: {
              properties?: (typeof rows)[0];
              geometry?: { coordinates: [number, number] };
            }[];
          }
        ).features?.map((f) => {
          const p = f.properties;
          if (!p || !f.geometry?.coordinates) {
            return {};
          }
          return {
            ...p,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          };
        }) ?? []);
    const out: AddressSuggestionItem[] = [];
    for (const r of rows) {
      if (r.rank?.confidence != null && r.rank.confidence < 0.3) {
        continue;
      }
      if (
        r.rank?.importance != null &&
        r.rank.importance < MIN_CONFIDENCE_CITY
      ) {
        continue;
      }
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) {
        continue;
      }
      const line = (r.formatted ?? r.name ?? '').trim();
      if (line.length < 2) {
        continue;
      }
      const placeId = this.encodeFromCoords(r.lat as number, r.lon as number);
      const item: AddressSuggestionItem = {
        placeId,
        mainText: (r.name ?? line.split(',')[0] ?? line)
          .toString()
          .slice(0, 120),
        secondaryText: (r.formatted ?? r.address_line2 ?? line).slice(0, 200),
        provider: this.providerId,
        resolved: {
          addressLine: line.slice(0, 500),
          city:
            this.cityFromProperties(r.properties) ??
            pickCityFromOsmStyleAddress(r.address),
          latitude: r.lat as number,
          longitude: r.lon as number,
          sourceProvider: this.providerId,
          sourceReference: placeId,
        },
      };
      out.push(item);
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
    const apiKey = this.getKey();
    if (!apiKey) {
      throw new BadRequestException({
        code: 'ADDRESS_GF_KEY',
        message: 'Geoapify is not configured',
      });
    }
    const { lat, lon } = this.parseCoords(placeId);
    const u = new URL(`${this.base}/geocode/reverse`);
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lon));
    u.searchParams.set('apiKey', apiKey);
    u.searchParams.set('format', 'json');
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
          message: 'Geoapify reverse failed',
        });
      }
      throw new Error(`geoapify http ${res.status}`);
    }
    const raw = (await res.json()) as {
      results?: {
        formatted?: string;
        lat?: number;
        lon?: number;
        name?: string;
        properties?: {
          city?: string;
          county?: string;
          state?: string;
          formatted?: string;
        };
      }[];
    };
    let r = raw.results?.[0];
    if (!r?.formatted) {
      const feat = (
        raw as unknown as {
          features?: {
            properties: {
              formatted: string;
              lat: number;
              lon: number;
              city?: string;
              county?: string;
              state?: string;
            };
            geometry: { coordinates: [number, number] };
          }[];
        }
      ).features?.[0];
      if (feat) {
        const p = feat.properties;
        r = {
          formatted: p.formatted,
          lat: p.lat ?? feat.geometry.coordinates[1],
          lon: p.lon ?? feat.geometry.coordinates[0],
          properties: p,
        };
      }
    }
    if (!r?.formatted || r.lat == null || r.lon == null) {
      throw new BadRequestException({
        code: 'ADDRESS_PLACE_NOT_FOUND',
        message: 'Place not found',
      });
    }
    const line = r.formatted;
    return {
      addressLine: line.slice(0, 500),
      city:
        this.cityFromProperties(r.properties) ??
        pickCityFromOsmStyleAddress(
          (r as { properties?: Record<string, string> }).properties,
        ),
      latitude: r.lat,
      longitude: r.lon,
      sourceProvider: this.providerId,
      sourceReference: placeId.trim(),
    };
  }
}
