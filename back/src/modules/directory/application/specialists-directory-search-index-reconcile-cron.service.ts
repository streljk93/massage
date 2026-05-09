import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketplaceListingEdgesIndexService } from './marketplace-listing-edges-index.service';

/**
 * Подстраховка консистентности индекса рёбер листинга (stale Typesense vs OLTP).
 * События из outbox **не** заменяют полный проход при сбоях провайдера.
 */
@Injectable()
export class SpecialistsDirectorySearchIndexReconcileCronService {
  private readonly log = new Logger(
    SpecialistsDirectorySearchIndexReconcileCronService.name,
  );

  constructor(private readonly index: MarketplaceListingEdgesIndexService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async nightlyReindexListedSpecialists(): Promise<void> {
    this.log.log('nightlyReindexListingEdges: старт');
    const r = await this.index.reindexAllListingEdges();
    this.log.log(
      `nightlyReindexListingEdges: обработано ${String(r.processed)}, ошибок ${String(r.errors)}`,
    );
  }
}
