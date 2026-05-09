import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'typesense';
import type {
  MarketplaceListingEdgesSearchInput,
  MarketplaceListingEdgesSearchResult,
  MarketplaceSearchHit,
  SearchEngine,
} from './search-engine.port';

/**
 * Коллекция рёбер листинга: id документа = `SpecialistOffering.id`
 * ({@link buildMarketplaceListingEdgeDocument}).
 */
const LISTING_EDGES_COLLECTION_FIELDS = [
  { name: 'schemaVersion', type: 'int32' },
  { name: 'listingKind', type: 'string', optional: true },
  { name: 'specialistId', type: 'string', facet: true },
  { name: 'organizationOfferingId', type: 'string', optional: true },
  { name: 'organizationId', type: 'string', optional: true },
  { name: 'offeringTitle', type: 'string' },
  { name: 'listingName', type: 'string', optional: true },
  { name: 'bio', type: 'string', optional: true },
  { name: 'categorySlug', type: 'string', facet: true },
  { name: 'majorSlug', type: 'string', facet: true },
  { name: 'minPriceVnd', type: 'int32' },
  { name: 'maxPriceVnd', type: 'int32' },
  { name: 'specialistReviewsCount', type: 'int32' },
  { name: 'specialistRatingAverage', type: 'float' },
  { name: 'specialistCreatedAtUnix', type: 'int64' },
  { name: 'listingEdgeSortKey', type: 'string' },
  { name: 'gender', type: 'string', facet: true, optional: true },
  { name: 'listedInDirectory', type: 'bool', facet: true },
  { name: 'listingGeo', type: 'geopoint', optional: true },
] as const;

/**
 * Реализация {@link SearchEngine} поверх Typesense. Без `TYPESENSE_API_KEY` —
 * не инстанцируется фабрикой.
 */
@Injectable()
export class TypesenseSearchEngine implements SearchEngine {
  private readonly log = new Logger(TypesenseSearchEngine.name);
  private readonly client: Client;
  private readonly marketplaceCollection: string;
  private readonly listingEdgesCollection: string;
  private ensuredListingEdges = false;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('search.typesense.host', '127.0.0.1');
    const port = this.config.get<number>('search.typesense.port', 8108);
    const protocol = this.config.get<'http' | 'https'>(
      'search.typesense.protocol',
      'http',
    );
    const apiKey = this.config.get<string>('search.typesense.apiKey', '');
    this.marketplaceCollection = this.config.get<string>(
      'search.typesense.marketplaceCollection',
      'marketplace_offerings_v1',
    );
    this.listingEdgesCollection =
      this.config.get<string>(
        'search.typesense.listingEdgesCollection',
        'marketplace_listing_edges_v1',
      ) || 'marketplace_listing_edges_v1';
    this.client = new Client({
      nodes: [{ host, port, protocol }],
      apiKey,
      connectionTimeoutSeconds: 5,
    });
    if (!apiKey) {
      this.log.warn(
        'TypesenseSearchEngine: пустой TYPESENSE_API_KEY — вызовы к коллекции могут провалиться',
      );
    }
  }

  async upsertMarketplaceOfferingDocument(input: {
    organizationOfferingId: string;
    document: Record<string, unknown>;
  }): Promise<void> {
    await this.client
      .collections(this.marketplaceCollection)
      .documents()
      .upsert({
        id: input.organizationOfferingId,
        ...input.document,
      });
  }

  async deleteMarketplaceOfferingDocument(
    organizationOfferingId: string,
  ): Promise<void> {
    try {
      await this.client
        .collections(this.marketplaceCollection)
        .documents(organizationOfferingId)
        .delete();
    } catch (e) {
      this.log.warn(
        `deleteMarketplaceOfferingDocument: ${organizationOfferingId} — ${String(e)}`,
      );
    }
  }

  async searchMarketplace(input: {
    q: string;
    perPage: number;
    page: number;
  }): Promise<{ hits: MarketplaceSearchHit[]; found: number }> {
    const result = await this.client
      .collections(this.marketplaceCollection)
      .documents()
      .search({
        q: input.q || '*',
        query_by: 'title,categorySlug',
        per_page: input.perPage,
        page: input.page,
      });
    const hits =
      result.hits?.map((h) => (h.document ?? {}) as MarketplaceSearchHit) ?? [];
    return { hits, found: result.found ?? 0 };
  }

  async ensureListingEdgesCollection(): Promise<void> {
    if (this.ensuredListingEdges) {
      return;
    }
    try {
      await this.client
        .collections(this.listingEdgesCollection)
        .retrieve();
    } catch {
      await this.client.collections().create({
        name: this.listingEdgesCollection,
        fields: [...LISTING_EDGES_COLLECTION_FIELDS],
      });
      this.log.log(
        `Создана коллекция Typesense ${this.listingEdgesCollection}`,
      );
    }
    this.ensuredListingEdges = true;
  }

  async upsertListingEdgeDocument(input: {
    edgeId: string;
    document: Record<string, unknown>;
  }): Promise<void> {
    await this.ensureListingEdgesCollection();
    await this.client.collections(this.listingEdgesCollection).documents().upsert({
      id: input.edgeId,
      ...input.document,
    });
  }

  async deleteListingEdgeDocument(edgeId: string): Promise<void> {
    try {
      await this.ensureListingEdgesCollection();
      await this.client
        .collections(this.listingEdgesCollection)
        .documents(edgeId)
        .delete();
    } catch (e) {
      this.log.warn(`deleteListingEdgeDocument ${edgeId}: ${String(e)}`);
    }
  }

  async searchListingEdgesGrouped(
    input: MarketplaceListingEdgesSearchInput,
  ): Promise<MarketplaceListingEdgesSearchResult> {
    await this.ensureListingEdgesCollection();
    const qRaw = (input.q ?? '').trim();
    const q = qRaw === '' || qRaw === '*' ? '*' : qRaw;
    const result = await this.client
      .collections(this.listingEdgesCollection)
      .documents()
      .search({
        q,
        query_by: input.queryBy,
        filter_by: input.filterBy,
        sort_by: input.sortBy,
        page: input.page,
        per_page: input.perPage,
        group_by: input.groupByField,
        group_limit: input.groupLimit,
      });
    const groups = result.grouped_hits ?? [];
    const specialistIds = groups
      .map((g) => {
        const doc = g.hits?.[0]?.document as Record<string, unknown> | undefined;
        const sid = doc?.specialistId;
        if (typeof sid === 'string' && sid.length > 0) {
          return sid;
        }
        const k0 = g.group_key?.[0];
        return typeof k0 === 'string' && k0.length > 0 ? k0 : null;
      })
      .filter((x): x is string => x != null && x.trim() !== '');
    return {
      specialistIds,
      foundGroups: result.found ?? 0,
    };
  }
}
