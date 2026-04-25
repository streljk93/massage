import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  JwtAccessOptionalGuard,
  type AuthenticatedUser,
} from '../../../common/guards';
import { parseDirectoryListLimit } from '../../../common/pagination/parse-directory-list-limit';
import { parseDirectoryListRadiusFromQuery } from '../../../common/pagination/parse-directory-list-radius.query';
import {
  parseListCategorySlugsCsv,
  parseOptionalMajorCategorySlug,
} from '../../../common/pagination/directory-list-search-query.parse';
import { PersonalizationService } from '../application/personalization.service';
import {
  ingestPersonalizationEventsBodySchema,
  type IngestPersonalizationEventsBody,
} from '../dto/personalization-body.schema';
import {
  ingestPersonalizationEventsRequestSchema,
  ingestPersonalizationEventsResponseSchema,
  personalizationRecommendationsResponseSchema,
} from './personalization.openapi-schemas';

const RECOMMENDATIONS_MAX_LIST = 12;

type AuthedOrGuest = Request & { user?: AuthenticatedUser };

function parsePerListLimit(
  listLimitRaw: string | undefined,
  fallback: number,
): number {
  if (listLimitRaw === undefined || listLimitRaw === '') {
    return fallback;
  }
  const n = parseDirectoryListLimit(listLimitRaw);
  return Math.min(RECOMMENDATIONS_MAX_LIST, n);
}

@ApiTags('personalization')
@Controller('personalization')
export class PersonalizationController {
  constructor(
    private readonly personalizationService: PersonalizationService,
  ) {}

  @Post('events')
  @UseGuards(JwtAccessOptionalGuard)
  @ApiOperation({
    summary: 'События витрины (для портрета и рекомендаций)',
    description:
      'Без токена передавайте `sessionId` (8+ символов). `metadata` — только ' +
      'slug’и категорий, id фильтра, `lat`/`lng` (числа), `majorSlug`; без PII и текста поиска.',
  })
  @ApiBody({ schema: ingestPersonalizationEventsRequestSchema })
  @ApiOkResponse({ schema: ingestPersonalizationEventsResponseSchema })
  @ApiBadRequestResponse({ description: 'Нет sessionId у гостя' })
  async ingestEvents(
    @Req() req: AuthedOrGuest,
    @Body(new ZodValidationPipe(ingestPersonalizationEventsBodySchema))
    body: IngestPersonalizationEventsBody,
  ) {
    if (body.sessionId == null && req.user == null) {
      throw new BadRequestException({
        code: 'SESSION_OR_AUTH_REQUIRED',
        message: 'Нужен access token или sessionId',
      });
    }
    if (body.sessionId != null && body.sessionId.length < 8) {
      throw new BadRequestException({
        code: 'SESSION_ID_TOO_SHORT',
        message: 'sessionId не короче 8 символов',
      });
    }
    return this.personalizationService.ingestEvents({
      userId: req.user?.id ?? null,
      sessionId: body.sessionId?.trim() ?? null,
      body,
    });
  }

  @Get('recommendations')
  @UseGuards(JwtAccessOptionalGuard)
  @ApiOperation({
    summary: 'Персональные рекомендации (салоны и мастера)',
    description:
      'Гость — отдача без фильтра по портрету. Авторизованный — портрет и фильтрация ' +
      'категориями; `majorSlug` и `categories` с поиска переопределяют портрет, если заданы.',
  })
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'majorSlug',
    required: false,
    description:
      'Фильтр по большой категории (как в поиске); иначе из портрета.',
  })
  @ApiQuery({
    name: 'categories',
    required: false,
    description: 'Подкатегории slug через запятую (как `categories` в поиске).',
  })
  @ApiQuery({
    name: 'listLimit',
    required: false,
    description: `Размер каждой из двух выдач (1–${RECOMMENDATIONS_MAX_LIST}, по умолчанию 6).`,
  })
  @ApiQuery({
    name: 'radiusM',
    required: false,
    description:
      'Вместе с `radiusLat` / `radiusLng` — круг, метры (как в каталоге).',
  })
  @ApiQuery({ name: 'radiusLat', required: false })
  @ApiQuery({ name: 'radiusLng', required: false })
  @ApiOkResponse({ schema: personalizationRecommendationsResponseSchema })
  async getRecommendations(
    @Req() req: AuthedOrGuest,
    @RequestLocale() locale: ApiLocale,
    @Query('majorSlug') majorSlugRaw: string | undefined,
    @Query('categories') categoriesRaw: string | undefined,
    @Query('listLimit') listLimitRaw: string | undefined,
    @Query('radiusM') radiusMRaw: string | undefined,
    @Query('radiusLat') radiusLatRaw: string | undefined,
    @Query('radiusLng') radiusLngRaw: string | undefined,
  ) {
    const listLimit = parsePerListLimit(listLimitRaw, 6);
    const majorFromQuery = parseOptionalMajorCategorySlug(majorSlugRaw);
    const categorySlugsFromQuery = parseListCategorySlugsCsv(categoriesRaw);
    const categorySlugsForService =
      categorySlugsFromQuery.length > 0 ? categorySlugsFromQuery : null;
    const radius = parseDirectoryListRadiusFromQuery(
      radiusMRaw,
      radiusLatRaw,
      radiusLngRaw,
    );
    const radiusForService =
      radius == null
        ? null
        : {
            radiusM: radius.radiusM,
            centerLat: radius.centerLat,
            centerLng: radius.centerLng,
          };
    return this.personalizationService.getRecommendations(
      req.user?.id ?? null,
      locale,
      {
        limitSpecialists: listLimit,
        limitOrganizations: listLimit,
        majorSlug: majorFromQuery,
        categorySlugs: categorySlugsForService,
        radius: radiusForService,
      },
    );
  }
}
