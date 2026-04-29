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
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  JwtAccessGuard,
  type AuthenticatedUser,
} from '../../../common/guards';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ContentModerationService } from '../application/content-moderation.service';
import type { ModerationRejectBody } from '../dto/moderation-resolve-body.schema';
import { moderationRejectBodySchema } from '../dto/moderation-resolve-body.schema';
import { ContentModeratorGuard } from '../guards/content-moderator.guard';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('moderation')
@Controller('moderation')
export class ContentModerationController {
  constructor(private readonly moderation: ContentModerationService) {}

  @Get('cases')
  @UseGuards(JwtAccessGuard, ContentModeratorGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Очередь ручной модерации открытых кейсов',
    description:
      'Требуется флаг модератора (`User.isContentModerator`).',
  })
  @ApiOkResponse({
    description: 'Список кейсов',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiForbiddenResponse({ description: 'Нет прав модератора контента' })
  async listCases(@Query('limit') limitRaw?: string) {
    const n = Math.min(Math.max(Number(limitRaw ?? '50') || 50, 1), 100);
    return this.moderation.listOpenCases(n);
  }

  @Post('cases/:caseId/approve')
  @UseGuards(JwtAccessGuard, ContentModeratorGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Разрешить контент (публикация во витрине)' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiForbiddenResponse({ description: 'Нет прав модератора контента' })
  async approve(
    @Req() req: AuthedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    await this.moderation.resolveCaseApprove(caseId, req.user.id);
    return { ok: true as const };
  }

  @Post('cases/:caseId/reject')
  @UseGuards(JwtAccessGuard, ContentModeratorGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Отклонить контент с причиной (не публикуется или снимается)',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiForbiddenResponse({ description: 'Нет прав модератора контента' })
  async reject(
    @Req() req: AuthedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodValidationPipe(moderationRejectBodySchema))
    body: ModerationRejectBody,
  ) {
    await this.moderation.resolveCaseReject(caseId, req.user.id, body.reason);
    return { ok: true as const };
  }
}
