import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { BookingsService } from '../../bookings/application/bookings.service';
import { SpecialistOnboardingService } from '../application/specialist-onboarding.service';
import { SpecialistPersonalCatalogService } from '../application/specialist-personal-catalog.service';
import { SpecialistWorkplaceService } from '../application/specialist-workplace.service';
import type { SpecialistActiveOrganizationBookingsPreviewQuery } from '../dto/specialist-active-organization-bookings-preview-query.schema';
import { specialistActiveOrganizationBookingsPreviewQuerySchema } from '../dto/specialist-active-organization-bookings-preview-query.schema';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { patchSpecialistActiveOrganizationBodySchema } from '../dto/patch-specialist-active-organization-body.schema';
import type { SalonCabinetBookingsListQuery } from '../dto/salon-cabinet-bookings-list-query.schema';
import { salonCabinetBookingsListQuerySchema } from '../dto/salon-cabinet-bookings-list-query.schema';
import {
  createSpecialistPersonalServiceBodySchema,
  patchSpecialistProfileBodySchema,
  type CreateSpecialistPersonalServiceBody,
  type PatchSpecialistProfileBody,
} from '../dto/specialist-body.schema';
import {
  createSpecialistPersonalServiceRequestSchema,
  createSpecialistPersonalServiceResponseSchema,
  deleteSpecialistPersonalServiceResponseSchema,
  patchSpecialistActiveOrganizationRequestSchema,
  patchSpecialistActiveOrganizationResponseSchema,
  patchSpecialistProfileRequestSchema,
  specialistActiveOrganizationBookingsPreviewResponseSchema,
  specialistMyOrganizationsResponseSchema,
  specialistMyWorkplaceJoinRequestsResponseSchema,
  specialistOnboardingResponseSchema,
  specialistSalonBookingsListResponseSchema,
} from './specialists.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

/**
 * Кабинет мастера по текущему пользователю (JWT).
 * Публичная витрина — `GET /specialists`, `GET /specialists/:id` в модуле directory;
 * здесь — сегмент `me`, чтобы не пересекаться с UUID в `:id`.
 */
@ApiTags('cabinet-specialists')
@Controller('specialists')
export class SpecialistsCabinetController {
  constructor(
    private readonly specialistWorkplaceService: SpecialistWorkplaceService,
    private readonly specialistOnboardingService: SpecialistOnboardingService,
    private readonly specialistPersonalCatalogService: SpecialistPersonalCatalogService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('me/organizations')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Организации, где мастер состоит в штате (активные членства). Отмечается текущее место приёма.',
  })
  @ApiOkResponse({ schema: specialistMyOrganizationsResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistMyOrganizations(@Req() req: AuthedRequest) {
    return this.specialistWorkplaceService.listMyOrganizations(req.user.id);
  }

  @Get('me/active-organization/bookings-preview')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'organizationId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Текущее место приёма мастера; должно совпадать с `activeOrganizationId` в ответе `GET /specialists/me/organizations`.',
  })
  @ApiOperation({
    summary:
      'Превью активных броней к вам в текущей организации — то же, что будет отменено при смене места приёма.',
  })
  @ApiOkResponse({
    schema: specialistActiveOrganizationBookingsPreviewResponseSchema,
  })
  @ApiBadRequestResponse({
    description:
      'organizationId не совпадает с текущим местом приёма (NOT_CURRENT_ACTIVE_WORKPLACE_ORGANIZATION)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async getSpecialistActiveOrganizationBookingsPreview(
    @Req() req: AuthedRequest,
    @Query(
      new ZodValidationPipe(
        specialistActiveOrganizationBookingsPreviewQuerySchema,
      ),
    )
    query: SpecialistActiveOrganizationBookingsPreviewQuery,
  ) {
    return this.specialistWorkplaceService.previewBookingsWhenLeavingActiveOrganization(
      req.user.id,
      query.organizationId,
      query.locale,
    );
  }

  @Get('me/workplace-join-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Заявки текущего мастера на вступление в организации (отправленные из кабинета).',
  })
  @ApiOkResponse({ schema: specialistMyWorkplaceJoinRequestsResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistMyWorkplaceJoinRequests(@Req() req: AuthedRequest) {
    return this.specialistWorkplaceService.listMyWorkplaceJoinRequests(
      req.user.id,
    );
  }

  @Get('me/salon-bookings')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiLocaleQueryDocs()
  @ApiQuery({
    name: 'scope',
    required: true,
    schema: {
      type: 'string',
      enum: ['managed', 'active_workplace'],
    },
    description:
      'managed — записи по всем организациям, где мастер owner/admin; active_workplace — только записи этого мастера в организации текущего места приёма.',
  })
  @ApiOperation({
    summary:
      'Список броней для бизнес-экрана: по управляемым салонам или только «мои» на текущем месте.',
  })
  @ApiOkResponse({ schema: specialistSalonBookingsListResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидный query' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Нет профиля специалиста' })
  async getSpecialistSalonBookings(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(salonCabinetBookingsListQuerySchema))
    query: SalonCabinetBookingsListQuery,
  ) {
    return this.bookingsService.listSalonCabinetBusiness(
      req.user.id,
      query.scope,
      query.locale,
    );
  }

  @Patch('me/active-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Текущая организация мастера (адрес витрины и новые записи). При смене или снятии (`organizationId`: null) активные брони на прежнем месте приёма отменяются.',
  })
  @ApiBody({ schema: patchSpecialistActiveOrganizationRequestSchema })
  @ApiOkResponse({ schema: patchSpecialistActiveOrganizationResponseSchema })
  @ApiBadRequestResponse({
    description: 'Нет активного членства в организации',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({
    description: 'Нет профиля специалиста или организация не найдена',
  })
  async patchSpecialistActiveOrganization(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchSpecialistActiveOrganizationBodySchema))
    body: PatchSpecialistActiveOrganizationBody,
  ) {
    return this.specialistWorkplaceService.setActiveOrganization(
      req.user.id,
      body,
    );
  }

  @Post('me/ensure')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Создать профиль специалиста, если ещё нет (без привязки к организации, не в витрине).',
  })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postEnsureSpecialist(@Req() req: AuthedRequest) {
    await this.specialistOnboardingService.ensureSpecialist(req.user.id);
    return this.specialistOnboardingService.getOnboarding(req.user.id);
  }

  @Get('me/onboarding')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Состояние онбординга мастера (карта шагов 1, 3, 4, 5, 6 для первого входа).',
  })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistOnboarding(@Req() req: AuthedRequest) {
    return this.specialistOnboardingService.getOnboarding(req.user.id);
  }

  @Patch('me/profile')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Поля профиля мастера: био, фото, опыт, массаж и т.д.',
  })
  @ApiBody({ schema: patchSpecialistProfileRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchSpecialistProfile(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchSpecialistProfileBodySchema))
    body: PatchSpecialistProfileBody,
  ) {
    return this.specialistOnboardingService.patchProfile(req.user.id, body);
  }

  @Post('me/onboarding/complete')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Завершить онбординг (после шага 5). Витрина с адресом салона — когда место работы подтверждено или создан свой салон.',
  })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiConflictResponse({
    description: 'Профиль, услуги или организация не готовы',
  })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postSpecialistOnboardingComplete(@Req() req: AuthedRequest) {
    return this.specialistOnboardingService.completeOnboarding(req.user.id);
  }

  @Post('me/services')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Личная услуга мастера без организации (organizationId = null, specialistId = текущий).',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: createSpecialistPersonalServiceRequestSchema })
  @ApiOkResponse({ schema: createSpecialistPersonalServiceResponseSchema })
  @ApiBadRequestResponse({ description: 'Категория или валюта' })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postSpecialistPersonalService(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(createSpecialistPersonalServiceBodySchema))
    body: CreateSpecialistPersonalServiceBody,
  ) {
    return this.specialistPersonalCatalogService.createPersonalService(
      req.user.id,
      body,
      locale,
    );
  }

  @Delete('me/services/:serviceId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Удалить личную услугу мастера (soft delete). Услуга должна быть с organizationId = null.',
  })
  @ApiParam({
    name: 'serviceId',
    format: 'uuid',
    description: 'Идентификатор услуги из POST /specialists/me/services',
  })
  @ApiOkResponse({ schema: deleteSpecialistPersonalServiceResponseSchema })
  @ApiNotFoundResponse({
    description: 'Профиля мастера нет, услуга не найдена или не личная',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async deleteSpecialistPersonalService(
    @Req() req: AuthedRequest,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.specialistPersonalCatalogService.deletePersonalService(
      req.user.id,
      serviceId,
    );
  }
}
