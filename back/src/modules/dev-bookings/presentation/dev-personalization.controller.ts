import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DevPersonalizationRecomputeService } from '../application/dev-personalization-recompute.service';
import {
  devRecomputePreferenceProfileBodySchema,
  type DevRecomputePreferenceProfileBody,
} from '../dto/dev-recompute-preference-profile-body.schema';
import { DevTestRoutesGuard } from '../guards/dev-test-routes.guard';
import {
  DevRecomputePreferenceProfileRequestSwaggerDto,
  DevRecomputePreferenceProfileResponseSwaggerDto,
} from './dev-recompute-preference-profile.swagger.dto';

@ApiTags('dev')
@Controller('dev/personalization')
@UseGuards(DevTestRoutesGuard)
export class DevPersonalizationController {
  constructor(
    private readonly devPersonalization: DevPersonalizationRecomputeService,
  ) {}

  @Post('recompute-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Dev] Пересчитать портрет персонализации по email',
    description:
      'Вызывает `PersonalizationService.recomputeProfileForUser` (тот же алгоритм, что cron и ingest). ' +
      'В ответе: сырые сигналы `inputsConsidered`, флаги `readiness.personalizationReady` (как GET рекомендаций без query) ' +
      'и `readiness.homeBlockWouldRender` (с учётом пустой/непустой выдачи каталога при `listLimit=3` как на главной). ' +
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true` — иначе `404`.',
  })
  @ApiBody({ type: DevRecomputePreferenceProfileRequestSwaggerDto })
  @ApiOkResponse({ type: DevRecomputePreferenceProfileResponseSwaggerDto })
  @ApiNotFoundResponse({
    description:
      'Ручка выключена (`404`) или пользователь с таким email не найден',
  })
  async recomputeProfile(
    @Body(new ZodValidationPipe(devRecomputePreferenceProfileBodySchema))
    body: DevRecomputePreferenceProfileBody,
  ) {
    return this.devPersonalization.recomputeProfileForUserByEmail(body);
  }
}
