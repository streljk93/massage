import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
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
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { patchSpecialistActiveOrganizationBodySchema } from '../dto/patch-specialist-active-organization-body.schema';
import {
  createSpecialistPersonalServiceBodySchema,
  patchSpecialistProfileBodySchema,
  type CreateSpecialistPersonalServiceBody,
  type PatchSpecialistProfileBody,
} from '../dto/specialist-body.schema';
import {
  createSpecialistPersonalServiceRequestSchema,
  createSpecialistPersonalServiceResponseSchema,
  patchSpecialistActiveOrganizationRequestSchema,
  patchSpecialistActiveOrganizationResponseSchema,
  patchSpecialistProfileRequestSchema,
  specialistOnboardingResponseSchema,
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
  ) {}

  @Patch('me/active-organization')
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
  @ApiOperation({ summary: 'Поля профиля мастера: био, фото, опыт, массаж и т.д.' })
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
}
