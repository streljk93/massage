import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DevFcmTestService } from '../application/dev-fcm-test.service';
import {
  devTestFcmBodySchema,
  type DevTestFcmBody,
} from '../dto/dev-test-fcm-body.schema';
import { DevTestRoutesGuard } from '../guards/dev-test-routes.guard';
import {
  devTestFcmRequestSchema,
  devTestFcmResponseSchema,
} from './dev-fcm-test.openapi-schemas';

@ApiTags('dev')
@Controller('dev/notifications')
@UseGuards(DevTestRoutesGuard)
export class DevFcmTestController {
  constructor(private readonly devFcm: DevFcmTestService) {}

  @Post('test-fcm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Dev] Тестовый FCM push по email',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true` (иначе 404). ' +
      'Ищет пользователя по email, проверяет `UserFcmToken`, шлёт произвольный title + text. ' +
      'Проверка сервисного ключа Firebase и веб-конфига без прод-ролей. ' +
      '**Получатель** — тот **браузер**, в котором этот user однажды залогинился и **зарегистрировал FCM** (`POST push-tokens`); не тот, кто дергает ручку из Swagger с другой сессии. ' +
      'Опционально `delaySeconds` (0–120): **ждать N с**, затем отправить FCM; HTTP «висит» ~N с, чтобы переключить вкладку и поймать пуш в фоне. ' +
      '`fcm.successCount: 1` — FCM принял запрос, панель OS видна в том окне, где залогинен этот user и не запрещены уведомления.',
  })
  @ApiBody({ schema: devTestFcmRequestSchema })
  @ApiOkResponse({ schema: devTestFcmResponseSchema })
  @ApiBadRequestResponse({ description: 'Нет FCM токенов у пользователя' })
  @ApiNotFoundResponse({ description: 'Пользователь с email не найден' })
  @ApiServiceUnavailableResponse({
    description: 'FCM (Firebase Admin) не инициализирован',
  })
  async testFcm(
    @Body(new ZodValidationPipe(devTestFcmBodySchema)) body: DevTestFcmBody,
  ) {
    return this.devFcm.sendTestFcmToUserByEmail(body);
  }
}
