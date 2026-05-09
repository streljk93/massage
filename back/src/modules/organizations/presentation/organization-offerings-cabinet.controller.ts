import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import {
  createOrganizationOfferingDraftBodySchema,
  type CreateOrganizationOfferingDraftBody,
} from '../dto/create-organization-offering-draft-body.schema';
import {
  patchOrganizationOfferingBodySchema,
  type PatchOrganizationOfferingBody,
} from '../dto/patch-organization-offering-body.schema';
import {
  postOfferingPriceOptionBodySchema,
  type PostOfferingPriceOptionBody,
} from '../dto/post-offering-price-option-body.schema';
import {
  patchOfferingPriceOptionBodySchema,
  type PatchOfferingPriceOptionBody,
} from '../dto/patch-offering-price-option-body.schema';
import {
  postSpecialistOfferingAssignmentBodySchema,
  type PostSpecialistOfferingAssignmentBody,
} from '../dto/post-specialist-offering-assignment-body.schema';
import {
  patchSpecialistOfferingAssignmentBodySchema,
  type PatchSpecialistOfferingAssignmentBody,
} from '../dto/patch-specialist-offering-assignment-body.schema';
import {
  postSpecialistOfferingPriceOverrideBodySchema,
  type PostSpecialistOfferingPriceOverrideBody,
} from '../dto/post-specialist-offering-price-override-body.schema';
import {
  patchSpecialistOfferingPriceOverrideBodySchema,
  type PatchSpecialistOfferingPriceOverrideBody,
} from '../dto/patch-specialist-offering-price-override-body.schema';
import { OrganizationOfferingsCabinetService } from '../application/organization-offerings-cabinet.service';
import {
  assignableSpecialistsListResponseSchema,
  createOrganizationOfferingDraftRequestSchema,
  createOrganizationOfferingDraftResponseSchema,
  createOfferingPriceOptionRequestSchema,
  createOfferingPriceOptionResponseSchema,
  createSpecialistOfferingAssignmentRequestSchema,
  createSpecialistOfferingAssignmentResponseSchema,
  createSpecialistOfferingPriceOverrideRequestSchema,
  createSpecialistOfferingPriceOverrideResponseSchema,
  organizationOfferingPatchResponseSchema,
  organizationOfferingsListResponseSchema,
  patchOfferingPriceOptionRequestSchema,
  patchOfferingPriceOptionResponseSchema,
  patchOrganizationOfferingRequestSchema,
  patchSpecialistOfferingAssignmentRequestSchema,
  patchSpecialistOfferingAssignmentResponseSchema,
  patchSpecialistOfferingPriceOverrideRequestSchema,
  patchSpecialistOfferingPriceOverrideResponseSchema,
  publishOrganizationOfferingResponseSchema,
} from './organization-offerings-cabinet.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('cabinet-organizations-offerings')
@Controller('organizations/:organizationId/offerings')
export class OrganizationOfferingsCabinetController {
  constructor(
    private readonly offeringsCabinet: OrganizationOfferingsCabinetService,
  ) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Список коммерческих офферов точки (OrganizationOffering): опции и привязки мастеров.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: organizationOfferingsListResponseSchema })
  @ApiUnauthorizedResponse()
  async listMine(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.listOfferings(userId, organizationId);
  }

  @Post()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Создать черновик оффера точки (draft).' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiBody({ schema: createOrganizationOfferingDraftRequestSchema })
  @ApiCreatedResponse({ schema: createOrganizationOfferingDraftResponseSchema })
  @ApiUnauthorizedResponse()
  async createDraft(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body(new ZodValidationPipe(createOrganizationOfferingDraftBodySchema))
    body: CreateOrganizationOfferingDraftBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.createOfferingDraft(userId, organizationId, body);
  }

  @Get('assignable-specialists')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Список специалистов с активным employment в точке (для ручной привязки к офферу).',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: assignableSpecialistsListResponseSchema })
  @ApiUnauthorizedResponse()
  async listAssignableSpecialists(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.listAssignableSpecialists(userId, organizationId);
  }

  @Patch(':offeringId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Обновить оффер (slug/category — только до первой публикации; title/description — всегда).',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiBody({ schema: patchOrganizationOfferingRequestSchema })
  @ApiOkResponse({ schema: organizationOfferingPatchResponseSchema })
  @ApiUnauthorizedResponse()
  async patchOffering(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Body(new ZodValidationPipe(patchOrganizationOfferingBodySchema))
    body: PatchOrganizationOfferingBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.patchOffering(
      userId,
      organizationId,
      offeringId,
      body,
    );
  }

  @Post(':offeringId/publish')
  @HttpCode(200)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Опубликовать оффер (нужна ≥1 активная VND опция). Переиндексация marketplace-рёбер активных мастеров точки.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiOkResponse({ schema: publishOrganizationOfferingResponseSchema })
  @ApiUnauthorizedResponse()
  async publishOffering(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.publishOffering(
      userId,
      organizationId,
      offeringId,
    );
  }

  @Post(':offeringId/price-options')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Добавить вариант цены/длительности оффера.' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiBody({ schema: createOfferingPriceOptionRequestSchema })
  @ApiCreatedResponse({ schema: createOfferingPriceOptionResponseSchema })
  @ApiUnauthorizedResponse()
  async createPriceOption(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Body(new ZodValidationPipe(postOfferingPriceOptionBodySchema))
    body: PostOfferingPriceOptionBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.createOfferingPriceOption(
      userId,
      organizationId,
      offeringId,
      body,
    );
  }

  @Patch(':offeringId/price-options/:optionId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Изменить статус/цену опции; remove=true — soft-delete (архив + deletedAt).',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiParam({ name: 'optionId', format: 'uuid' })
  @ApiBody({ schema: patchOfferingPriceOptionRequestSchema })
  @ApiOkResponse({ schema: patchOfferingPriceOptionResponseSchema })
  @ApiUnauthorizedResponse()
  async patchPriceOption(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
    @Body(new ZodValidationPipe(patchOfferingPriceOptionBodySchema))
    body: PatchOfferingPriceOptionBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.patchOfferingPriceOption(
      userId,
      organizationId,
      offeringId,
      optionId,
      body,
    );
  }

  @Post(':offeringId/specialist-assignments')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Привязать мастера к офферу (employment в точке обязателен). Восстанавливает soft-removed привязку.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiBody({ schema: createSpecialistOfferingAssignmentRequestSchema })
  @ApiCreatedResponse({
    schema: createSpecialistOfferingAssignmentResponseSchema,
  })
  @ApiUnauthorizedResponse()
  async createSpecialistAssignment(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Body(new ZodValidationPipe(postSpecialistOfferingAssignmentBodySchema))
    body: PostSpecialistOfferingAssignmentBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.createSpecialistOfferingAssignment(
      userId,
      organizationId,
      offeringId,
      body.specialistId,
    );
  }

  @Patch(':offeringId/specialist-assignments/:assignmentId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Изменить статус привязки мастера (`removed` — soft-delete привязки и рёбер листинга после reconcile).',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiParam({ name: 'assignmentId', format: 'uuid' })
  @ApiBody({ schema: patchSpecialistOfferingAssignmentRequestSchema })
  @ApiOkResponse({
    schema: patchSpecialistOfferingAssignmentResponseSchema,
  })
  @ApiUnauthorizedResponse()
  async patchSpecialistAssignment(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body(new ZodValidationPipe(patchSpecialistOfferingAssignmentBodySchema))
    body: PatchSpecialistOfferingAssignmentBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.patchSpecialistOfferingAssignment(
      userId,
      organizationId,
      offeringId,
      assignmentId,
      body,
    );
  }

  @Post(':offeringId/specialist-assignments/:assignmentId/price-overrides')
  @HttpCode(200)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Персональная цена мастера по конкретной опции оффера (upsert по паре привязка+опция).',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiParam({ name: 'assignmentId', format: 'uuid' })
  @ApiBody({ schema: createSpecialistOfferingPriceOverrideRequestSchema })
  @ApiOkResponse({
    schema: createSpecialistOfferingPriceOverrideResponseSchema,
  })
  @ApiUnauthorizedResponse()
  async createPriceOverride(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body(
      new ZodValidationPipe(postSpecialistOfferingPriceOverrideBodySchema),
    )
    body: PostSpecialistOfferingPriceOverrideBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.createSpecialistOfferingPriceOverride(
      userId,
      organizationId,
      offeringId,
      assignmentId,
      body,
    );
  }

  @Patch(
    ':offeringId/specialist-assignments/:assignmentId/price-overrides/:overrideId',
  )
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Изменить сумму персональной цены мастера.' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiParam({ name: 'assignmentId', format: 'uuid' })
  @ApiParam({ name: 'overrideId', format: 'uuid' })
  @ApiBody({ schema: patchSpecialistOfferingPriceOverrideRequestSchema })
  @ApiOkResponse({
    schema: patchSpecialistOfferingPriceOverrideResponseSchema,
  })
  @ApiUnauthorizedResponse()
  async patchPriceOverride(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Param('overrideId', new ParseUUIDPipe()) overrideId: string,
    @Body(
      new ZodValidationPipe(patchSpecialistOfferingPriceOverrideBodySchema),
    )
    body: PatchSpecialistOfferingPriceOverrideBody,
  ) {
    const userId = req.user.id;
    return this.offeringsCabinet.patchSpecialistOfferingPriceOverride(
      userId,
      organizationId,
      offeringId,
      assignmentId,
      overrideId,
      body,
    );
  }

  @Delete(
    ':offeringId/specialist-assignments/:assignmentId/price-overrides/:overrideId',
  )
  @HttpCode(204)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Удалить персональную цену мастера по опции.' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiParam({ name: 'assignmentId', format: 'uuid' })
  @ApiParam({ name: 'overrideId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async deletePriceOverride(
    @Req() req: AuthedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('offeringId', new ParseUUIDPipe()) offeringId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Param('overrideId', new ParseUUIDPipe()) overrideId: string,
  ): Promise<void> {
    const userId = req.user.id;
    await this.offeringsCabinet.deleteSpecialistOfferingPriceOverride(
      userId,
      organizationId,
      offeringId,
      assignmentId,
      overrideId,
    );
  }
}
