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
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { HiringService } from '../application/hiring.service';
import {
  applyToJobPostingBodySchema,
  candidateListQuerySchema,
  createJobPostingBodySchema,
  patchJobPostingBodySchema,
  patchResumeBodySchema,
  reviewApplicationBodySchema,
  type ApplyToJobPostingBody,
  type CandidateListQuery,
  type CreateJobPostingBody,
  type PatchJobPostingBody,
  type PatchResumeBody,
  type ReviewApplicationBody,
} from '../dto/hiring.schemas';
import {
  applyRequestSchema,
  candidateListResponseSchema,
  contactMutationResponseSchema,
  contactsListResponseSchema,
  jobPostingMutationRequestSchema,
  jobPostingSchema,
  jobPostingsListResponseSchema,
  patchResumeRequestSchema,
  respondRequestSchema,
  resumeSchema,
} from './hiring.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('hiring')
@Controller('hiring')
export class HiringController {
  constructor(private readonly hiring: HiringService) {}

  @Get('candidates')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Глобальный поиск кандидатов по публичным резюме.' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'skillCategoryIds', required: false })
  @ApiQuery({ name: 'experienceMinYears', required: false })
  @ApiQuery({ name: 'experienceMaxYears', required: false })
  @ApiOkResponse({ schema: candidateListResponseSchema })
  @ApiUnauthorizedResponse()
  async listCandidates(
    @Query(new ZodValidationPipe(candidateListQuerySchema))
    query: CandidateListQuery,
  ) {
    return this.hiring.listCandidates(query);
  }

  @Get('job-postings/:jobPostingId/candidates')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Подбор кандидатов под вакансию.' })
  @ApiParam({ name: 'jobPostingId', format: 'uuid' })
  @ApiOkResponse({ schema: candidateListResponseSchema })
  async listJobPostingCandidates(
    @Req() req: AuthedRequest,
    @Param('jobPostingId', ParseUUIDPipe) jobPostingId: string,
    @Query(new ZodValidationPipe(candidateListQuerySchema))
    query: CandidateListQuery,
  ) {
    return this.hiring.listJobPostingCandidates(
      req.user.id,
      jobPostingId,
      query,
    );
  }

  @Get('job-postings')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Публичный список открытых вакансий (MVP stub).' })
  @ApiOkResponse({ schema: jobPostingsListResponseSchema })
  listPublicJobPostings() {
    return { jobPostings: [] };
  }

  @Post('job-postings/:jobPostingId/apply')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'jobPostingId', format: 'uuid' })
  @ApiBody({ schema: applyRequestSchema })
  @ApiOkResponse({ schema: contactMutationResponseSchema })
  async applyToJobPosting(
    @Req() req: AuthedRequest,
    @Param('jobPostingId', ParseUUIDPipe) jobPostingId: string,
    @Body(new ZodValidationPipe(applyToJobPostingBodySchema))
    body: ApplyToJobPostingBody,
  ) {
    return this.hiring.applyToJobPosting(req.user.id, jobPostingId, body);
  }
}

@ApiTags('cabinet-organizations-hiring')
@Controller('organizations/:organizationId/hiring')
export class OrganizationHiringController {
  constructor(private readonly hiring: HiringService) {}

  @Get('job-postings')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: jobPostingsListResponseSchema })
  async listJobPostings(
    @Req() req: AuthedRequest,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.hiring.listJobPostings(req.user.id, organizationId);
  }

  @Post('job-postings')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiBody({ schema: jobPostingMutationRequestSchema })
  @ApiOkResponse({ schema: jobPostingSchema })
  async createJobPosting(
    @Req() req: AuthedRequest,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body(new ZodValidationPipe(createJobPostingBodySchema))
    body: CreateJobPostingBody,
  ) {
    return this.hiring.createJobPosting(req.user.id, organizationId, body);
  }

  @Patch('job-postings/:jobPostingId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'jobPostingId', format: 'uuid' })
  @ApiBody({ schema: jobPostingMutationRequestSchema })
  @ApiOkResponse({ schema: jobPostingSchema })
  async patchJobPosting(
    @Req() req: AuthedRequest,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('jobPostingId', ParseUUIDPipe) jobPostingId: string,
    @Body(new ZodValidationPipe(patchJobPostingBodySchema))
    body: PatchJobPostingBody,
  ) {
    return this.hiring.patchJobPosting(
      req.user.id,
      organizationId,
      jobPostingId,
      body,
    );
  }

  @Get('applications')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkResponse({ schema: contactsListResponseSchema })
  async listApplications(
    @Req() req: AuthedRequest,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.hiring.listOrganizationApplications(
      req.user.id,
      organizationId,
    );
  }

  @Patch('applications/:contactId')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'contactId', format: 'uuid' })
  @ApiBody({ schema: respondRequestSchema })
  @ApiOkResponse({ schema: contactMutationResponseSchema })
  async reviewApplication(
    @Req() req: AuthedRequest,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body(new ZodValidationPipe(reviewApplicationBodySchema))
    body: ReviewApplicationBody,
  ) {
    return this.hiring.reviewApplication(
      req.user.id,
      organizationId,
      contactId,
      body,
    );
  }
}

@ApiTags('cabinet-specialists-hiring')
@Controller('specialists/me')
export class SpecialistHiringController {
  constructor(private readonly hiring: HiringService) {}

  @Get('resume')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ schema: resumeSchema })
  async getResume(@Req() req: AuthedRequest) {
    return this.hiring.getMyResume(req.user.id);
  }

  @Patch('resume')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ schema: patchResumeRequestSchema })
  @ApiOkResponse({ schema: resumeSchema })
  async patchResume(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchResumeBodySchema))
    body: PatchResumeBody,
  ) {
    return this.hiring.patchMyResume(req.user.id, body);
  }
}
