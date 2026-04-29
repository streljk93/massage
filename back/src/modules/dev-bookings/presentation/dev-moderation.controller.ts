import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ModerationOllamaService } from '../../moderation/application/moderation-ollama.service';
import { ContentModerationService } from '../../moderation/application/content-moderation.service';
import {
  devModerationOllamaEvalBodySchema,
  type DevModerationOllamaEvalBody,
} from '../dto/dev-moderation-ollama-eval-body.schema';
import {
  devModerationResolveBodySchema,
  type DevModerationResolveBody,
} from '../dto/dev-moderation-resolve-body.schema';
import { DevModerationQueueService } from '../application/dev-moderation-queue.service';
import { DevTestRoutesGuard } from '../guards/dev-test-routes.guard';
import {
  devModerationOllamaEvalRequestSchema,
  devModerationOllamaEvalResponseSchema,
} from './dev-moderation-ollama-eval.openapi-schemas';

@ApiTags('dev')
@Controller('dev/moderation')
@UseGuards(DevTestRoutesGuard)
export class DevModerationController {
  constructor(
    private readonly queue: DevModerationQueueService,
    private readonly moderation: ContentModerationService,
    private readonly ollama: ModerationOllamaService,
  ) {}

  @Get('queue')
  @ApiOperation({
    summary: '[Dev] Очередь предмодерации — открытые кейсы и контент',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true`; иначе 404. ' +
      '`reference` — допустимые значения `PublicationModerationStatus`, `ContentModerationCaseKind`, `ContentModerationCaseStatus` и семантика approve/reject.',
  })
  @ApiOkResponse({ description: 'Снимок очереди и справочник статусов' })
  async getQueue() {
    const [cases, reference] = await Promise.all([
      this.queue.getPendingQueueSnapshots(),
      Promise.resolve(this.queue.getReference()),
    ]);
    return { cases, reference };
  }

  @Post('ollama-eval')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiOperation({
    summary: '[Dev] Прогон текста через Ollama модерацию',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true`; иначе **404**. ' +
      'Вызывает `ModerationOllamaService.evaluateTexts` без записи в БД (как в проде). ' +
      'Без JWT. Нужен `OLLAMA_BASE_URL`; иначе `verdict: review`, `infraUnavailable: true`.',
    operationId: 'devModeration_ollamaEval',
  })
  @ApiBody({ schema: devModerationOllamaEvalRequestSchema })
  @ApiOkResponse({
    schema: devModerationOllamaEvalResponseSchema,
    description:
      'Результат `evaluateTexts`: парсится JSON модели `{ result, reason }` → `verdict` / `rawSummary`.',
  })
  async ollamaEval(
    @Body(new ZodValidationPipe(devModerationOllamaEvalBodySchema))
    body: DevModerationOllamaEvalBody,
  ) {
    const label = body.label?.trim() || 'preview';
    return this.ollama.evaluateTexts([{ label, text: body.text }]);
  }

  @Post('cases/:caseId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Dev] Одобрить или отклонить кейс модерации',
    description:
      'Только в dev. `decision: approve` — как `POST /moderation/cases/:id/approve`; `reject` — нужен `reason`. ' +
      '`moderatorUserId` в кейсе будет `null`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['decision'],
      properties: {
        decision: { enum: ['approve', 'reject'] },
        reason: { type: 'string', description: 'Обязательно при reject' },
      },
    },
  })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiNotFoundResponse({ description: 'Кейс не найден или ручка выключена' })
  @ApiBadRequestResponse({
    description: 'Кейс не открыт или нет reason при reject',
  })
  async resolveCase(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodValidationPipe(devModerationResolveBodySchema))
    body: DevModerationResolveBody,
  ) {
    if (body.decision === 'approve') {
      await this.moderation.resolveCaseApprove(caseId, null);
    } else {
      await this.moderation.resolveCaseReject(
        caseId,
        null,
        body.reason?.trim() ?? '',
      );
    }
    return { ok: true as const };
  }
}
