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
import { SpecialistWorkplaceService } from '../application/specialist-workplace.service';
import { UsersService } from '../application/users.service';
import type { PatchMeBody } from '../dto/patch-me-body.schema';
import { patchMeBodySchema } from '../dto/patch-me-body.schema';
import type { PatchSpecialistActiveOrganizationBody } from '../dto/patch-specialist-active-organization-body.schema';
import { patchSpecialistActiveOrganizationBodySchema } from '../dto/patch-specialist-active-organization-body.schema';
import {
  patchMeRequestSchema,
  patchSpecialistActiveOrganizationRequestSchema,
  patchSpecialistActiveOrganizationResponseSchema,
  userProfileSchema,
} from './users.openapi-schemas';

type AuthedRequest = Request & { user: AuthenticatedUser };

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly specialistWorkplaceService: SpecialistWorkplaceService,
  ) {}

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
  @ApiOperation({ summary: 'Обновить профиль (имя, аватар)' })
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

  @Patch('me/specialist/active-organization')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Текущая организация мастера (адрес витрины и новые записи). При смене активные брони на прежний адрес отменяются.',
  })
  @ApiBody({ schema: patchSpecialistActiveOrganizationRequestSchema })
  @ApiOkResponse({ schema: patchSpecialistActiveOrganizationResponseSchema })
  @ApiBadRequestResponse({
    description: 'Нет активного членства в организации',
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiNotFoundResponse({
    description: 'Нет профиля специалиста или организация не найдена',
  })
  async patchSpecialistActiveOrganization(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(patchSpecialistActiveOrganizationBodySchema))
    body: PatchSpecialistActiveOrganizationBody,
  ) {
    return this.specialistWorkplaceService.setActiveOrganization(
      req.user.id,
      body,
    );
  }
}
