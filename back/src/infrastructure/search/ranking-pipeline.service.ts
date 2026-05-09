import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type {
  MarketplaceSearchHit,
  SearchEngine,
} from './search-engine.port';
import { SEARCH_ENGINE } from './search-engine.port';

/**
 * Отделяет бизнес-ранжирование от retrieval движка (ADR §3.2.5).
 * Hits приходят из {@link SearchEngine}; порядок в MVP — сохранить как есть или по одному простому ключу из документа.
 */
@Injectable()
export class RankingPipelineService {
  private readonly log = new Logger(RankingPipelineService.name);

  constructor(@Inject(SEARCH_ENGINE) private readonly search: SearchEngine) {}

  /** Retrieval → применение продукта policy (tie-break здесь будет расширяться). */
  async rankedMarketplaceSearch(input: {
    q: string;
    perPage: number;
    page: number;
  }): Promise<MarketplaceSearchHit[]> {
    const { hits } = await this.search.searchMarketplace(input);
    if (!hits.length) {
      return [];
    }
    this.log.debug(`rankedMarketplaceSearch: ${hits.length} hits (MVP passthrough)`);
    return hits;
  }
}
