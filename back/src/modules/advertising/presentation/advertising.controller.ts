import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AdvertisingService } from '../application/advertising.service';
import { advertPlacementQuerySchema } from '../dto/advert-placement-query.schema';
import type { AdvertisementsListResponseDto } from '../dto/advertisements-list-response.dto';
import { advertisementsListResponseSchema } from './advertising.openapi-schemas';

@ApiTags('advertising')
@Controller('advertisements')
export class AdvertisingController {
  constructor(private readonly advertisingService: AdvertisingService) {}

  @Get()
  @ApiOperation({
    summary: 'Реклама и баннеры по слоту показа',
    description:
      'Активные объявления для `placement` (например `home_promo` — карусель на главном экране). Тексты по `locale` (en, vi, ru): запрошенная локаль → en → канонические поля сущности. `ownerKind`: internal — наша реклама, external — партнёр или сторонний инвентарь.',
  })
  @ApiQuery({
    name: 'placement',
    required: true,
    example: 'home_promo',
    description:
      'Слот показа: home_promo (главная), в будущем — search_banner и др.',
  })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: advertisementsListResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверный формат placement или locale',
  })
  async listByPlacement(
    @Query(new ZodValidationPipe(advertPlacementQuerySchema))
    query: { placement: string },
    @RequestLocale() locale: ApiLocale,
  ): Promise<AdvertisementsListResponseDto> {
    return this.advertisingService.listByPlacement(query.placement, locale);
  }
}
