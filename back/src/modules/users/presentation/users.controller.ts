import {
  Body,
  Controller,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
import { SpecialistOnboardingService } from '../application/specialist-onboarding.service';
import { SpecialistPersonalCatalogService } from '../application/specialist-personal-catalog.service';
import { SpecialistWorkplaceService } from '../application/specialist-workplace.service';
import { UsersService } from '../application/users.service';
import type { PatchMeBody } from '../dto/patch-me-body.schema';
import { patchMeBodySchema } from '../dto/patch-me-body.schema';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { patchSpecialistActiveOrganizationBodySchema } from '../dto/patch-specialist-active-organization-body.schema';
import {
  workplaceJoinRequestListQuerySchema,
  workplaceJoinRequestReviewBodySchema,
  type WorkplaceJoinRequestListQuery,
  type WorkplaceJoinRequestReviewBody,
} from '../dto/workplace-join-request.schema';
import {
  createOnboardingOrganizationBodySchema,
  createSpecialistPersonalServiceBodySchema,
  type CreateOnboardingOrganizationBody,
  type CreateSpecialistPersonalServiceBody,
  joinOnboardingOrganizationBodySchema,
  type JoinOnboardingOrganizationBody,
  patchSpecialistOnboardingProfileBodySchema,
  type PatchSpecialistOnboardingProfileBody,
} from '../dto/specialist-onboarding-body.schema';
import {
  createOnboardingOrganizationRequestSchema,
  createSpecialistPersonalServiceRequestSchema,
  createSpecialistPersonalServiceResponseSchema,
  joinOnboardingOrganizationRequestSchema,
  patchMeRequestSchema,
  patchSpecialistActiveOrganizationRequestSchema,
  patchSpecialistActiveOrganizationResponseSchema,
  patchSpecialistOnboardingProfileRequestSchema,
  specialistOnboardingResponseSchema,
  userProfileSchema,
  workplaceJoinRequestListResponseSchema,
  workplaceJoinRequestReviewRequestSchema,
  workplaceJoinRequestReviewResponseSchema,
} from './users.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly specialistWorkplaceService: SpecialistWorkplaceService,
    private readonly specialistOnboardingService: SpecialistOnboardingService,
    private readonly specialistPersonalCatalogService: SpecialistPersonalCatalogService,
  ) {}

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Текущий пользователь (профиль)' })
  @ApiOkResponse({ schema: userProfileSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Пользователь удалён или не найден' })
  async me(@Req() req: AuthedRequest) {
    return this.usersService.getMe(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Обновить профиль (имя, аватар, локаль UI)' })
  @ApiBody({ schema: patchMeRequestSchema })
  @ApiOkResponse({ schema: userProfileSchema })
  @ApiBadRequestResponse({ description: 'Ошибка валидации тела запроса' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Пользователь удалён или не найден' })
  async patchMe(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchMeBodySchema)) body: PatchMeBody,
  ) {
    return this.usersService.patchMe(req.user.id, body);
  }

  @Patch('me/specialist/active-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Текущая организация мастера (адрес витрины и новые записи). При смене активные брони на прежний адрес отменяются.',
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

  @Post('me/specialist/ensure')
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

  @Get('me/specialist/onboarding')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Состояние онбординга специалиста (шаги 1, 3, 4, 5, 6).' })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async getSpecialistOnboarding(@Req() req: AuthedRequest) {
    return this.specialistOnboardingService.getOnboarding(req.user.id);
  }

  @Patch('me/specialist/profile')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Поля профиля мастера (онбординг): био, фото, опыт, сила, подстройка.' })
  @ApiBody({ schema: patchSpecialistOnboardingProfileRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async patchSpecialistOnboardingProfile(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchSpecialistOnboardingProfileBodySchema))
    body: PatchSpecialistOnboardingProfileBody,
  ) {
    return this.specialistOnboardingService.patchProfile(req.user.id, body);
  }

  @Post('me/specialist/onboarding/complete')
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

  @Post('me/specialist/onboarding/join-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Онбординг: заявка на работу в выбранном салоне; членство и рабочее место — после решения владельца или админа салона.',
  })
  @ApiBody({ schema: joinOnboardingOrganizationRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiConflictResponse({
    description:
      'Уже выбрано место работы (WORKPLACE_ALREADY_SET) или уже активный член организации (ALREADY_ORGANIZATION_MEMBER)',
  })
  @ApiNotFoundResponse({
    description: 'Профиля специалиста или организации нет',
  })
  @ApiForbiddenResponse({
    description:
      'Организация заблокировала заявки от этого мастера (WORKPLACE_JOIN_BLOCKED)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postJoinOnboardingOrganization(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(joinOnboardingOrganizationBodySchema))
    body: JoinOnboardingOrganizationBody,
  ) {
    return this.specialistOnboardingService.joinOrganization(
      req.user.id,
      body,
    );
  }

  @Get('me/organizations/:organizationId/workplace-join-requests')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Заявки мастеров в салон: список для владельца организации или активного мастера с ролью owner/admin.',
    description: 'По умолчанию отдаётся только status=pending; передайте status=all для всего.',
  })
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
    return this.specialistOnboardingService.listWorkplaceJoinRequestsForOrganization(
      req.user.id,
      organizationId,
      query,
    );
  }

  @Post(
    'me/organizations/:organizationId/workplace-join-requests/:requestId/review',
  )
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Решение по заявке мастера: принять (трудоустройство), отклонить или заблокировать повторные заявки.',
  })
  @ApiBody({ schema: workplaceJoinRequestReviewRequestSchema })
  @ApiOkResponse({ schema: workplaceJoinRequestReviewResponseSchema })
  @ApiBadRequestResponse({ description: 'Невалидное тело (decision)' })
  @ApiForbiddenResponse({
    description: 'Нет прав управлять заявками (NOT_ORGANIZATION_MANAGER)',
  })
  @ApiNotFoundResponse({
    description:
      'Нет pending-заявки с этим id для организации (WORKPLACE_JOIN_REQUEST_NOT_FOUND и др.)',
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
    return this.specialistOnboardingService.reviewWorkplaceJoinRequest(
      req.user.id,
      organizationId,
      requestId,
      body,
    );
  }

  @Post('me/specialist/onboarding/create-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Онбординг: создать салон (текущий пользователь = владелец), локаль витрины, подкатегории, привязка как место приёма.',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: createOnboardingOrganizationRequestSchema })
  @ApiOkResponse({ schema: specialistOnboardingResponseSchema })
  @ApiBadRequestResponse({ description: 'Категории или валидация тела' })
  @ApiConflictResponse({ description: 'Уже выбрана организация' })
  @ApiNotFoundResponse({ description: 'Профиля специалиста нет' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async postCreateOnboardingOrganization(
    @Req() req: AuthedRequest,
    @RequestLocale() locale: ApiLocale,
    @Body(new ZodValidationPipe(createOnboardingOrganizationBodySchema))
    body: CreateOnboardingOrganizationBody,
  ) {
    return this.specialistOnboardingService.createOrganizationAndJoin(
      req.user.id,
      body,
      locale,
    );
  }

  @Post('me/specialist/services')
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
}
