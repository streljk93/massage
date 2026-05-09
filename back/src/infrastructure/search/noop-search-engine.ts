import { Injectable, Logger } from '@nestjs/common';
import type {
  MarketplaceListingEdgesSearchInput,
  MarketplaceListingEdgesSearchResult,
  MarketplaceSearchHit,
  SearchEngine,
} from './search-engine.port';

@Injectable()
export class NoopSearchEngine implements SearchEngine {
  private readonly log = new Logger(NoopSearchEngine.name);

  async upsertMarketplaceOfferingDocument(_input: {
    organizationOfferingId: string;
    document: Record<string, unknown>;
  }): Promise<void> {
    /* no-op */
  }

  async deleteMarketplaceOfferingDocument(
    _organizationOfferingId: string,
  ): Promise<void> {
    /* no-op */
  }

  async searchMarketplace(_input: {
    q: string;
    perPage: number;
    page: number;
  }): Promise<{ hits: MarketplaceSearchHit[]; found: number }> {
    this.log.debug(
      'searchMarketplace: noop engine — пустая выдача; listing остаётся на SQL path',
    );
    return { hits: [], found: 0 };
  }

  async ensureListingEdgesCollection(): Promise<void> {
    /* no-op */
  }

  async upsertListingEdgeDocument(_input: {
    edgeId: string;
    document: Record<string, unknown>;
  }): Promise<void> {
    /* no-op */
  }

  async deleteListingEdgeDocument(_edgeId: string): Promise<void> {
    /* no-op */
  }

  async searchListingEdgesGrouped(
    _input: MarketplaceListingEdgesSearchInput,
  ): Promise<MarketplaceListingEdgesSearchResult> {
    this.log.debug(
      'searchListingEdgesGrouped: noop — группированная выдача пуста',
    );
    return { specialistIds: [], foundGroups: 0 };
  }
}
