import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { FavoritesService } from '../application/favorites.service';
import {
  addFavoriteBodySchema,
  type AddFavoriteBody,
  mergeFavoritesBodySchema,
  type MergeFavoritesBody,
} from '../dto/favorites-body.schema';
import {
  addFavoriteRequestSchema,
  favoritesListResponseSchema,
  favoritesOrganizationsListingResponseSchema,
  favoritesSpecialistsListingResponseSchema,
  mergeFavoritesRequestSchema,
} from './favorites.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Список избранного текущего пользователя' })
  @ApiOkResponse({ schema: favoritesListResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async list(@Req() req: AuthedRequest) {
    return this.favoritesService.list(req.user.id);
  }

  @Get('organizations')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiOperation({
    summary:
      'Избранные салоны с полным набором полей карточки витрины (как в поиске)',
  })
  @ApiOkResponse({ schema: favoritesOrganizationsListingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async listOrganizationsListing(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.favoritesService.listOrganizationsWithListing(
      req.user.id,
      locale,
    );
  }

  @Get('specialists')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiOperation({
    summary:
      'Избранные мастера с полным набором полей карточки витрины (как в поиске)',
  })
  @ApiOkResponse({ schema: favoritesSpecialistsListingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async listSpecialistsListing(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.favoritesService.listSpecialistsWithListing(
      req.user.id,
      locale,
    );
  }

  @Post('merge')
  @HttpCode(200)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Добавить несколько избранных (например после гостевого режима)',
    description:
      'Идемпотентно: существующие пары пропускаются. Несуществующие цели отбрасываются.',
  })
  @ApiBody({ schema: mergeFavoritesRequestSchema })
  @ApiOkResponse({ schema: favoritesListResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async merge(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(mergeFavoritesBodySchema))
    body: MergeFavoritesBody,
  ) {
    return this.favoritesService.merge(req.user.id, body);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Добавить в избранное' })
  @ApiBody({ schema: addFavoriteRequestSchema })
  @ApiCreatedResponse({ description: 'Добавлено или уже было в избранном' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async add(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(addFavoriteBodySchema)) body: AddFavoriteBody,
  ) {
    await this.favoritesService.add(req.user.id, body);
  }

  @Delete(':targetKind/:targetId')
  @HttpCode(204)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Убрать из избранного' })
  @ApiParam({
    name: 'targetKind',
    enum: ['organization', 'specialist'],
  })
  @ApiParam({ name: 'targetId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Удалено или не было в списке' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async remove(
    @Req() req: AuthedRequest,
    @Param('targetKind') targetKindRaw: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    const targetKind =
      this.favoritesService.parseTargetKindParam(targetKindRaw);
    await this.favoritesService.remove(req.user.id, targetKind, targetId);
  }
}
