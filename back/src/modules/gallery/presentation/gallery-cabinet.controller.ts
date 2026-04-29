import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GalleryService } from '../application/gallery.service';
import {
  reorderGalleryItemsBodySchema,
  type ReorderGalleryItemsBody,
} from '../dto/reorder-gallery-items-body.schema';
import {
  organizationVitrineGalleryResponseSchema,
  reorderGalleryItemsRequestSchema,
  reorderGalleryItemsResponseSchema,
} from './gallery.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('galleries')
@Controller('galleries')
export class GalleryCabinetController {
  constructor(private readonly galleryService: GalleryService) {}

  @Get('by-owner/organization/:organizationId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Галерея витрины организации (кабинет)',
    description:
      'Возвращает `galleryId` и элементы в порядке `sortOrder` для последующего PATCH `/galleries/{galleryId}/items/order`.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: organizationVitrineGalleryResponseSchema })
  @ApiForbiddenResponse({
    description: 'Нет прав (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getOrganizationVitrineGallery(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.galleryService.getOrganizationVitrineGalleryForManagers(
      req.user.id,
      organizationId,
    );
  }

  @Patch(':galleryId/items/order')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Задать порядок элементов галереи',
    description:
      'Обновляет sortOrder у элементов; первый в списке становится «главным» кадром (для витрины организации — это обложка в каталоге).',
  })
  @ApiParam({ name: 'galleryId', format: 'uuid' })
  @ApiBody({ schema: reorderGalleryItemsRequestSchema })
  @ApiOkResponse({ schema: reorderGalleryItemsResponseSchema })
  @ApiBadRequestResponse({
    description: 'Неверный набор id (GALLERY_ORDER_MISMATCH и др.)',
  })
  @ApiForbiddenResponse({ description: 'Нет прав (NOT_ORGANIZATION_MANAGER)' })
  @ApiNotFoundResponse({ description: 'Галерея не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchItemsOrder(
    @Req() req: AuthedRequest,
    @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string,
    @Body(new ZodValidationPipe(reorderGalleryItemsBodySchema))
    body: ReorderGalleryItemsBody,
  ) {
    await this.galleryService.reorderItems(
      req.user.id,
      galleryId,
      body.orderedItemIds,
    );
    return { ok: true as const };
  }
}
