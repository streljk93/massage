import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ModerationOllamaService } from '../../moderation/application/moderation-ollama.service';
import { ImageNsfwModerationService } from '../../moderation/application/image-nsfw-moderation.service';
import { ContentModerationService } from '../../moderation/application/content-moderation.service';
import { FilesService } from '../../files/application/files.service';
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
import {
  devModerationImageEvalMultipartRequestSchema,
  devModerationImageEvalResponseSchema,
} from './dev-moderation-image-eval.openapi-schemas';

const devImageModerationUploadInterceptor = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
});

@ApiTags('dev')
@Controller('dev/moderation')
@UseGuards(DevTestRoutesGuard)
export class DevModerationController {
  constructor(
    private readonly queue: DevModerationQueueService,
    private readonly moderation: ContentModerationService,
    private readonly ollama: ModerationOllamaService,
    private readonly files: FilesService,
    private readonly imageNsfw: ImageNsfwModerationService,
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

  @Post('image-eval')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(devImageModerationUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiProduces('application/json')
  @ApiOperation({
    summary:
      '[Dev] Прогон изображения через NSFW image-moderation (NudeNet + CLIP)',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true`; иначе **404**. ' +
      'Файл загружается в публичное хранилище (`POST /files/public`), затем вызывается тот же `POST …/v1/score`, что для витрины. ' +
      'Нужны `IMAGE_MODERATION_BASE_URL` и `MODERATION_FILE_FETCH_ORIGIN` (абсолютный URL для скачивания файла контейнером). ' +
      'Без JWT.',
    operationId: 'devModeration_imageEval',
  })
  @ApiBody({ schema: devModerationImageEvalMultipartRequestSchema })
  @ApiOkResponse({
    schema: devModerationImageEvalResponseSchema,
    description: 'Итог `scoreSingleImageDev` и пути загрузки',
  })
  @ApiBadRequestResponse({
    description: 'Нет файла или не изображение (ожидается `image/*`)',
  })
  async imageEval(@UploadedFile() upload: Express.Multer.File | undefined) {
    this.files.assertFile(upload);
    if (!upload.mimetype.startsWith('image/')) {
      throw new BadRequestException({
        code: 'IMAGE_FILE_REQUIRED',
        message:
          'multipart field `file` must be a photo (jpeg, png or webp; no gif)',
      });
    }

    const uploaded = await this.files.upload(upload, 'public');
    const storedPath = uploaded.url;

    if (!this.imageNsfw.isEnabled()) {
      return {
        stored_path: storedPath,
        resolved_image_url: null,
        infraUnavailable: true,
        moderation_file_fetch_misconfigured: false,
        score: null,
      };
    }

    const resolved = this.imageNsfw.resolvePublicUrl(storedPath);
    if (resolved == null) {
      return {
        stored_path: storedPath,
        resolved_image_url: null,
        infraUnavailable: false,
        moderation_file_fetch_misconfigured: true,
        score: null,
        error:
          'Не задан MODERATION_FILE_FETCH_ORIGIN — нельзя построить URL для скачивания файла контейнером image-moderation.',
      };
    }

    const scored = await this.imageNsfw.scoreSingleImageDev(resolved);
    if (scored.infra_disabled) {
      return {
        stored_path: storedPath,
        resolved_image_url: resolved,
        infraUnavailable: true,
        moderation_file_fetch_misconfigured: false,
        score: null,
      };
    }
    if (scored.ok) {
      return {
        stored_path: storedPath,
        resolved_image_url: resolved,
        infraUnavailable: false,
        moderation_file_fetch_misconfigured: false,
        score: scored.score,
      };
    }
    return {
      stored_path: storedPath,
      resolved_image_url: resolved,
      infraUnavailable: false,
      moderation_file_fetch_misconfigured: false,
      error: scored.error,
      http_status: scored.http_status,
      score: null,
    };
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
