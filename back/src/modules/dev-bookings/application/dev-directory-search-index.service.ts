import { Injectable } from '@nestjs/common';
import { MarketplaceListingEdgesIndexService } from '../../directory/application/marketplace-listing-edges-index.service';

/** Dev-only: ручной полный проход индекса listing edges (`SpecialistOffering`). */
@Injectable()
export class DevDirectorySearchIndexService {
  constructor(
    private readonly listingEdgesIndex: MarketplaceListingEdgesIndexService,
  ) {}

  reindexAllListingEdges() {
    return this.listingEdgesIndex.reindexAllListingEdges();
  }
}
