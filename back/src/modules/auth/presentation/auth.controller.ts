import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AuthService } from '../application/auth.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginBody } from '../dto/login-body.schema';
import { loginBodySchema } from '../dto/login-body.schema';
import type { OauthLoginBody } from '../dto/oauth-login-body.schema';
import { oauthLoginBodySchema } from '../dto/oauth-login-body.schema';
import type { RefreshBody } from '../dto/refresh-body.schema';
import { refreshBodySchema } from '../dto/refresh-body.schema';
import type { RegisterBody } from '../dto/register-body.schema';
import { registerBodySchema } from '../dto/register-body.schema';
import type { RegisterPendingResponseDto } from '../dto/register-pending.dto';
import type { ResendEmailVerificationBody } from '../dto/resend-email-verification-body.schema';
import { resendEmailVerificationBodySchema } from '../dto/resend-email-verification-body.schema';
import type { VerifyEmailRegistrationBody } from '../dto/verify-email-registration-body.schema';
import { verifyEmailRegistrationBodySchema } from '../dto/verify-email-registration-body.schema';
import {
  authBadRequestVerificationSchema,
  authEmailConflictSchema,
  authBadRequestOauthSchema,
  authForbiddenSchema,
  authLoginRequestSchema,
  authOauthLoginRequestSchema,
  authRefreshRequestSchema,
  authRegisterPendingResponseSchema,
  authRegisterRequestSchema,
  authResendVerificationRequestSchema,
  authServiceUnavailableMailSchema,
  authTokensResponseSchema,
  authUnauthorizedSchema,
  authVerifyEmailRequestSchema,
} from './auth.openapi-schemas';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Регистрация по email и паролю',
    description:
      'Запись в `User` не создаётся: сохраняется ожидание верификации и на email уходит 6-значный код. Учётная запись и токены — после `POST /auth/verify-email`.',
  })
  @ApiBody({ schema: authRegisterRequestSchema })
  @ApiCreatedResponse({ schema: authRegisterPendingResponseSchema })
  @ApiConflictResponse({ schema: authEmailConflictSchema })
  @ApiServiceUnavailableResponse({ schema: authServiceUnavailableMailSchema })
  @ApiBadRequestResponse({
    description:
      'Ошибка валидации (Zod): неверный формат email, пароль короче 8 символов и т.д.',
  })
  async register(
    @Body(new ZodValidationPipe(registerBodySchema))
    body: RegisterBody,
  ): Promise<RegisterPendingResponseDto> {
    return this.authService.register(body);
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @ApiOperation({ summary: 'Подтвердить email кодом из письма' })
  @ApiBody({ schema: authVerifyEmailRequestSchema })
  @ApiOkResponse({ schema: authTokensResponseSchema })
  @ApiBadRequestResponse({ schema: authBadRequestVerificationSchema })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailRegistrationBodySchema))
    body: VerifyEmailRegistrationBody,
  ): Promise<AuthResponseDto> {
    return this.authService.verifyEmailRegistration(body);
  }

  @Post('resend-verification')
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Повторно отправить код подтверждения',
    description:
      'Только пока регистрация не завершена (`PendingRegistration`). Пароль — тот же, что при регистрации.',
  })
  @ApiBody({ schema: authResendVerificationRequestSchema })
  @ApiNoContentResponse({ description: 'Код отправлен' })
  @ApiUnauthorizedResponse({ schema: authUnauthorizedSchema })
  @ApiBadRequestResponse({ schema: authBadRequestVerificationSchema })
  @ApiServiceUnavailableResponse({ schema: authServiceUnavailableMailSchema })
  async resendVerification(
    @Body(new ZodValidationPipe(resendEmailVerificationBodySchema))
    body: ResendEmailVerificationBody,
  ): Promise<void> {
    return this.authService.resendEmailVerification(body);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Вход по email и паролю' })
  @ApiBody({ schema: authLoginRequestSchema })
  @ApiOkResponse({ schema: authTokensResponseSchema })
  @ApiUnauthorizedResponse({ schema: authUnauthorizedSchema })
  @ApiForbiddenResponse({ schema: authForbiddenSchema })
  @ApiBadRequestResponse({ description: 'Ошибка валидации тела запроса' })
  async login(
    @Body(new ZodValidationPipe(loginBodySchema))
    body: LoginBody,
  ): Promise<AuthResponseDto> {
    return this.authService.login(body);
  }

  @Post('login/oauth')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Вход и регистрация через Google',
    description:
      'Сервер проверяет `idToken` (GSI) и при необходимости создаёт `User` + `UserOAuthAccount` или привязывает к существующему email.',
  })
  @ApiBody({ schema: authOauthLoginRequestSchema })
  @ApiOkResponse({ schema: authTokensResponseSchema })
  @ApiBadRequestResponse({ schema: authBadRequestOauthSchema })
  @ApiBadRequestResponse({ description: 'Ошибка Zod: нет `idToken` / `accessToken` для провайдера' })
  async loginWithOauth(
    @Body(new ZodValidationPipe(oauthLoginBodySchema))
    body: OauthLoginBody,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithOauth(body);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Обновление пары JWT по refresh-токену' })
  @ApiBody({ schema: authRefreshRequestSchema })
  @ApiOkResponse({ schema: authTokensResponseSchema })
  @ApiUnauthorizedResponse({ schema: authUnauthorizedSchema })
  @ApiBadRequestResponse({ description: 'Ошибка валидации тела запроса' })
  async refresh(
    @Body(new ZodValidationPipe(refreshBodySchema))
    body: RefreshBody,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(body.refreshToken);
  }
}
