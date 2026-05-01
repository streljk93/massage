import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAccessGuard } from '../../../common/guards';
import {
  ApiLocaleQueryDocs,
  RequestLocale,
  type ApiLocale,
} from '../../../common/i18n';
import { AddressResolutionService } from '../application/address-resolution.service';
import {
  type AddressResolveBody,
  type AddressReverseBody,
  type AddressSuggestionsQuery,
  addressResolveBodySchema,
  addressReverseBodySchema,
  addressSuggestionsQuerySchema,
} from '../dto/address-api.zod';
import {
  addressResolveRequestSchema,
  addressResolveResponseSchema,
  addressReverseRequestSchema,
  addressSuggestionsResponseSchema,
} from './address.openapi-schemas';

@ApiTags('address')
@Controller('address')
@UseGuards(JwtAccessGuard)
@ApiBearerAuth('access-token')
export class AddressController {
  constructor(private readonly addressResolution: AddressResolutionService) {}

  @Get('suggestions')
  @Throttle({ default: { ttl: 60_000, limit: 50 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Подсказки по адресу (внешний сервис на стороне API)',
    description:
      'Сервер идёт по цепочке геокодеров (см. `back/.env.example`: LocationIQ, Geoapify, OpenCage, Nominatim). Клиент не зовёт внешние API напрямую.',
  })
  @ApiQuery({ name: 'query', required: true, minLength: 2, maxLength: 200 })
  @ApiLocaleQueryDocs()
  @ApiOkResponse({ schema: addressSuggestionsResponseSchema })
  @ApiBadRequestResponse({ description: 'Query слишком короткий или пустой' })
  @ApiUnauthorizedResponse()
  @ApiServiceUnavailableResponse({
    description: 'Ни один провайдер адреса не сконфигурирован',
  })
  @ApiTooManyRequestsResponse()
  async suggestions(
    @Query(new ZodValidationPipe(addressSuggestionsQuerySchema))
    query: AddressSuggestionsQuery,
    @RequestLocale() locale: ApiLocale,
  ) {
    const suggestions = await this.addressResolution.searchSuggestions(
      query.query,
      { locale },
    );
    return { suggestions };
  }

  @Post('resolve')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Разрешить place id поставщика в канонический адрес (координаты + строки для БД)',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: addressResolveRequestSchema })
  @ApiOkResponse({ schema: addressResolveResponseSchema })
  @ApiBadRequestResponse({ description: 'Неизвестный provider или place id' })
  @ApiNotFoundResponse({ description: 'Место не найдено у поставщика' })
  @ApiUnauthorizedResponse()
  @ApiServiceUnavailableResponse()
  @ApiTooManyRequestsResponse()
  async resolve(
    @Body(new ZodValidationPipe(addressResolveBodySchema))
    body: AddressResolveBody,
    @RequestLocale() locale: ApiLocale,
  ) {
    const resolved = await this.addressResolution.resolveToCanonical(
      body.provider,
      body.placeId,
      { locale },
    );
    return { resolved };
  }

  @Post('reverse')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Обратное геокодирование (координаты → канонический адрес)',
    description:
      'Сервер проходит по тому же порядку провайдеров, что и подсказки, пока один не вернёт адрес.',
  })
  @ApiLocaleQueryDocs()
  @ApiBody({ schema: addressReverseRequestSchema })
  @ApiOkResponse({ schema: addressResolveResponseSchema })
  @ApiBadRequestResponse({
    description: 'Невалидные координаты или адрес не найден',
  })
  @ApiUnauthorizedResponse()
  @ApiServiceUnavailableResponse()
  @ApiTooManyRequestsResponse()
  async reverse(
    @Body(new ZodValidationPipe(addressReverseBodySchema))
    body: AddressReverseBody,
    @RequestLocale() locale: ApiLocale,
  ) {
    const resolved = await this.addressResolution.reverseToCanonical(
      body.latitude,
      body.longitude,
      { locale },
    );
    return { resolved };
  }
}
