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
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { OrganizationCabinetService } from '../../organizations/application/organization-cabinet.service';

import { devWorkplaceJoinReviewBodySchema } from '../dto/dev-workplace-join-review-body.schema';
import type { DevWorkplaceJoinReviewBody } from '../dto/dev-workplace-join-review-body.schema';
import { DevWorkplaceJoinReviewSwaggerDto } from './dev-workplace-join-review.swagger.dto';
import { DevTestRoutesGuard } from '../guards/dev-test-routes.guard';

@ApiTags('dev')
@Controller('dev/workplace-join-requests')
@UseGuards(DevTestRoutesGuard)
export class DevWorkplaceJoinReviewController {
  constructor(
    private readonly organizationCabinet: OrganizationCabinetService,
  ) {}

  @Post('review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Dev] Рассмотреть заявку на вступление по requestId',
    description:
      'Только при `NODE_ENV !== production` и без `DISABLE_DEV_TEST_ROUTES=true`. Иначе **404**. ' +
      'Тело: `requestId` + `decision` (`accept` | `reject` | `block`). `organizationId` из заявки подставляется автоматически; те же действия, что у кабинета, но без проверки прав владельца.',
  })
  @ApiBody({ type: DevWorkplaceJoinReviewSwaggerDto })
  @ApiResponse({
    status: 200,
    description: 'Решение записано',
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean' }, decision: { type: 'string' } },
    },
  })
  async postReview(
    @Body(new ZodValidationPipe(devWorkplaceJoinReviewBodySchema))
    body: DevWorkplaceJoinReviewBody,
  ) {
    return this.organizationCabinet.reviewPendingWorkplaceJoinRequestForDev(
      body.requestId,
      { decision: body.decision },
    );
  }
}
