/** Один hit из внешнего индекса (Typesense и т.п.). */
export type MarketplaceSearchHit = Record<string, unknown>;

/**
 * Сгруппированный retrieval: документ — рёбро **SpecialistOffering** (ADR: hit оффера + исполнитель),
 * `group_by specialistId`, `group_limit: 1` — одна строка на мастера в выдаче.
 */
export type MarketplaceListingEdgesSearchInput = {
  q: string | null;
  queryBy: string;
  filterBy: string;
  sortBy: string;
  /** 1-based, как Typesense `page`. */
  page: number;
  /** Число **групп** (мастеров), не документов-рёбер. */
  perPage: number;
  groupByField: string;
  groupLimit: number;
};

export type MarketplaceListingEdgesSearchResult = {
  specialistIds: string[];
  /** Всего групп (≈ число мастеров), см. Typesense `found` при группировке. */
  foundGroups: number;
};

/**
 * Порт внешнего движка поиска — **retrieval only**; ранжирование — в приложении (см. RankingPipeline).
 */
export interface SearchEngine {
  upsertMarketplaceOfferingDocument(input: {
    organizationOfferingId: string;
    document: Record<string, unknown>;
  }): Promise<void>;

  deleteMarketplaceOfferingDocument(
    organizationOfferingId: string,
  ): Promise<void>;

  searchMarketplace(input: {
    q: string;
    perPage: number;
    page: number;
  }): Promise<{ hits: MarketplaceSearchHit[]; found: number }>;

  /** Коллекция рёбер листинга (`search.typesense.listingEdgesCollection`). Документ id = SpecialistOffering.id. */
  ensureListingEdgesCollection(): Promise<void>;

  upsertListingEdgeDocument(input: {
    edgeId: string;
    document: Record<string, unknown>;
  }): Promise<void>;

  deleteListingEdgeDocument(edgeId: string): Promise<void>;

  searchListingEdgesGrouped(
    input: MarketplaceListingEdgesSearchInput,
  ): Promise<MarketplaceListingEdgesSearchResult>;
}

export const SEARCH_ENGINE = Symbol('SearchEngine');
