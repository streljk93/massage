import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AuthService } from '../application/auth.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginBody } from '../dto/login-body.schema';
import { loginBodySchema } from '../dto/login-body.schema';
import type { RefreshBody } from '../dto/refresh-body.schema';
import { refreshBodySchema } from '../dto/refresh-body.schema';
import type { RegisterBody } from '../dto/register-body.schema';
import { registerBodySchema } from '../dto/register-body.schema';
import {
  authEmailConflictSchema,
  authLoginRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema,
  authTokensResponseSchema,
  authUnauthorizedSchema,
} from './auth.openapi-schemas';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Регистрация по email и паролю' })
  @ApiBody({ schema: authRegisterRequestSchema })
  @ApiCreatedResponse({ schema: authTokensResponseSchema })
  @ApiConflictResponse({ schema: authEmailConflictSchema })
  @ApiBadRequestResponse({
    description: 'Ошибка валидации (Zod): неверный формат email, пароль короче 8 символов и т.д.',
  })
  async register(
    @Body(new ZodValidationPipe(registerBodySchema))
    body: RegisterBody,
  ): Promise<AuthResponseDto> {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Вход по email и паролю' })
  @ApiBody({ schema: authLoginRequestSchema })
  @ApiOkResponse({ schema: authTokensResponseSchema })
  @ApiUnauthorizedResponse({ schema: authUnauthorizedSchema })
  @ApiBadRequestResponse({ description: 'Ошибка валидации тела запроса' })
  async login(
    @Body(new ZodValidationPipe(loginBodySchema))
    body: LoginBody,
  ): Promise<AuthResponseDto> {
    return this.authService.login(body);
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
