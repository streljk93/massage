import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DevTestRoutesGuard } from '../guards/dev-test-routes.guard';
import { DevDirectorySearchIndexService } from '../application/dev-directory-search-index.service';

@ApiTags('dev')
@Controller('dev/search')
@UseGuards(DevTestRoutesGuard)
export class DevSearchIndexController {
  constructor(private readonly devSearchIndex: DevDirectorySearchIndexService) {}

  @Post('reindex-listing-edges')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[Dev] Переиндексировать listing edges (`SpecialistOffering`) в Typesense',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true`. ' +
      'Нужен настроенный Typesense и `TYPESENSE_API_KEY`. Вызывайте после первого включения indexed listing.',
  })
  @ApiOkResponse({
    description: 'Счётчики обработки',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
        errors: { type: 'number' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Ручка выключена' })
  async reindexListingEdges() {
    return this.devSearchIndex.reindexAllListingEdges();
  }
}
