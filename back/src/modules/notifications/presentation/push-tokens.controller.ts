import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { PushNotificationsService } from '../application/push-notifications.service';
import {
  registerPushTokenBodySchema,
  type RegisterPushTokenBody,
  revokePushTokenBodySchema,
  type RevokePushTokenBody,
} from '../dto/push-token-body.schema';
import {
  pushTokenOkResponseSchema,
  registerPushTokenRequestSchema,
  revokePushTokenRequestSchema,
} from './push-tokens.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('users')
@Controller('users')
export class PushTokensController {
  constructor(private readonly push: PushNotificationsService) {}

  @Post('me/push-tokens')
  @HttpCode(200)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Сохранить FCM token (web push)',
    description:
      'Регистрирует токен устройства для текущего пользователя. Повтор с тем же token переназначит userId (другой логин с того же браузера).',
  })
  @ApiBody({ schema: registerPushTokenRequestSchema })
  @ApiOkResponse({ schema: pushTokenOkResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async register(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(registerPushTokenBodySchema))
    body: RegisterPushTokenBody,
  ) {
    await this.push.registerToken(req.user.id, body.token, body.userAgent);
    return { ok: true as const };
  }

  @Delete('me/push-tokens')
  @HttpCode(204)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Удалить FCM token (отписка от push на этом устройстве)',
  })
  @ApiBody({ schema: revokePushTokenRequestSchema })
  @ApiNoContentResponse({ description: 'Токен удалён или не существовал' })
  @ApiUnauthorizedResponse({ description: 'Нет access token' })
  async revoke(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(revokePushTokenBodySchema))
    body: RevokePushTokenBody,
  ) {
    await this.push.removeToken(req.user.id, body.token);
  }
}
