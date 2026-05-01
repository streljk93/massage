import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard, type AuthenticatedUser } from '../../../common/guards';
import { UsersService } from '../application/users.service';
import type { PatchMeBody } from '../dto/patch-me-body.schema';
import { patchMeBodySchema } from '../dto/patch-me-body.schema';
import {
  patchMeRequestSchema,
  userProfileSchema,
} from './users.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Текущий пользователь (профиль)' })
  @ApiOkResponse({ schema: userProfileSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Пользователь удалён или не найден' })
  async me(@Req() req: AuthedRequest) {
    return this.usersService.getMe(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Обновить профиль (имя, аватар, локаль UI)' })
  @ApiBody({ schema: patchMeRequestSchema })
  @ApiOkResponse({ schema: userProfileSchema })
  @ApiBadRequestResponse({ description: 'Ошибка валидации тела запроса' })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({ description: 'Пользователь удалён или не найден' })
  async patchMe(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchMeBodySchema)) body: PatchMeBody,
  ) {
    return this.usersService.patchMe(req.user.id, body);
  }
}
