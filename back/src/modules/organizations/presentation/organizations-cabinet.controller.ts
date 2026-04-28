import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { OrganizationCabinetService } from '../application/organization-cabinet.service';
import { createOrganizationBodySchema, type CreateOrganizationBody } from '../dto/create-organization-body.schema';
import {
  workplaceJoinRequestListQuerySchema,
  workplaceJoinRequestReviewBodySchema,
  type WorkplaceJoinRequestListQuery,
  type WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';
import {
  createOrganizationRequestSchema,
  workplaceJoinRequestListResponseSchema,
  workplaceJoinRequestReviewRequestSchema,
  workplaceJoinRequestReviewResponseSchema,
} from './organizations-cabinet.openapi-schemas';
import { specialistOnboardingResponseSchema } from '../../specialists/presentation/specialists.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('cabinet-organizations')
@Controller('organizations')
export class OrganizationsCabinetController {
  constructor(private readonly organizationCabinet: OrganizationCabinetService) {}

  @Post()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Создать салон (текущий пользователь = владелец в БД), локаль витрины, подкатегории, место приёма.',
    description:
      'Требует Bearer. Публичный список салонов — `GET /organizations`; создание — `POST /organizations` с тем же префиксом ресурса. В ответе — актуальное состояние онбординга мастера.',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: createOrganizationRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiBadRequestResponse({ description: 'Категории или валидация тела' })
  @ApiConflictResponse({ description: 'Уже выбрана активная организация' })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postCreateOrganization(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(createOrganizationBodySchema))
    body: CreateOrganizationBody,
  ) {
    return this.organizationCabinet.createOrganizationAsOwner(
      req.user.id,
      body,
      locale,
    );
  }

  @Post(':organizationId/workplace-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Подать заявку на работу в салоне; членство — после решения владельца или админа.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiConflictResponse({
    description:
      'Уже выбрано место работы (WORKPLACE_ALREADY_SET) или уже активный член (ALREADY_ORGANIZATION_MEMBER)',
  })
  @ApiNotFoundResponse({
    description: 'Профиля специалиста или организации нет',
  })
  @ApiForbiddenResponse({
    description:
      'Организация заблокировала заявки от этого мастера (WORKPLACE_JOIN_BLOCKED)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postRequestWorkplaceJoin(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.organizationCabinet.requestWorkplaceJoin(
      req.user.id,
      organizationId,
    );
  }

  @Get(':organizationId/workplace-join-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Заявки мастеров в салон (владелец организации или мастер owner/admin).',
    description:
      'По умолчанию только status=pending; передайте status=all для полного списка.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'pending',
      'rejected',
      'blocked',
      'accepted',
      'withdrawn',
      'all',
    ],
  })
  @ApiOkResponse({ schema: workplaceJoinRequestListResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидный query (status)' })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять заявками (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({ description: 'Организация не найдена' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getWorkplaceJoinRequestsForOrganization(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Query(new ZodValidationPipe(workplaceJoinRequestListQuerySchema))
    query: WorkplaceJoinRequestListQuery,
  ) {
    return this.organizationCabinet.listWorkplaceJoinRequestsForOrganization(
      req.user.id,
      organizationId,
      query,
    );
  }

  @Post(':organizationId/workplace-join-requests/:requestId/review')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Решение по заявке: принять, отклонить или заблокировать повторные заявки от мастера.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'requestId', format: 'uuid' })
  @ApiBody({ schema: workplaceJoinRequestReviewRequestSchema })
  @ApiOkResponse({ schema: workplaceJoinRequestReviewResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело (decision)' })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять заявками (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({
    description:
      'Нет pending-заявки (WORKPLACE_JOIN_REQUEST_NOT_FOUND и др.)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postReviewWorkplaceJoinRequest(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body(new ZodValidationPipe(workplaceJoinRequestReviewBodySchema))
    body: WorkplaceJoinRequestReviewBody,
  ) {
    return this.organizationCabinet.reviewWorkplaceJoinRequest(
      req.user.id,
      organizationId,
      requestId,
      body,
    );
  }
}
