import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RankingPipelineService } from './ranking-pipeline.service';
import { SearchDocumentBuilderService } from './search-document-builder.service';
import { SearchProjectionShadowService } from './search-projection-shadow.service';
import { NoopSearchEngine } from './noop-search-engine';
import { TypesenseSearchEngine } from './typesense-search-engine';
import { SEARCH_ENGINE, type SearchEngine } from './search-engine.port';

function searchEngineFactory(config: ConfigService): SearchEngine {
  const backend = config.get<string>('search.listingBackend', 'sql');
  const hasKey =
    config.get<string>('search.typesense.apiKey', '').trim().length > 0;
  if (backend === 'indexed' && hasKey) {
    return new TypesenseSearchEngine(config);
  }
  return new NoopSearchEngine();
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SEARCH_ENGINE,
      inject: [ConfigService],
      useFactory: searchEngineFactory,
    },
    SearchDocumentBuilderService,
    RankingPipelineService,
    SearchProjectionShadowService,
  ],
  exports: [
    SEARCH_ENGINE,
    SearchDocumentBuilderService,
    RankingPipelineService,
    SearchProjectionShadowService,
  ],
})
export class SearchInfrastructureModule {}
