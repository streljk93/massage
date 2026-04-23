import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAccessGuard } from '../../../common/guards';
import { FilesService } from '../application/files.service';
import { fileUploadResponseSchema } from './files.openapi-schemas';

const uploadMultipartBody = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
};

const fileInterceptor = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Жёстче глобального лимита: загрузки/скачивания дороже и чаще используются в злоупотреблениях. */
@Throttle({
  default: {
    ttl: 60_000,
    limit: 80,
  },
})
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('public')
  @ApiOperation({
    summary: 'Загрузить публичный файл',
    description:
      'Объект в бакете с префиксом `public/`. Выдача через GET /files/public/:filename без JWT. Поле multipart: `file`. Типы: jpeg, png, webp, gif, pdf; до 10 МБ.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadMultipartBody)
  @ApiOkResponse({ schema: fileUploadResponseSchema })
  @ApiBadRequestResponse({ description: 'Нет файла или неподдерживаемый тип' })
  @ApiServiceUnavailableResponse({
    description:
      'Хранилище не настроено, MinIO/S3 недоступен или перегружен (503)',
  })
  @UseInterceptors(fileInterceptor)
  async uploadPublic(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.filesService.upload(file, 'public');
  }

  @Post('private')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Загрузить приватный файл',
    description:
      'Объект с префиксом `private/`. Скачивание только с **Bearer access** (тот же токен, что для защищённых ручек). Поле multipart: `file`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadMultipartBody)
  @ApiOkResponse({ schema: fileUploadResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  @ApiBadRequestResponse({ description: 'Нет файла или неподдерживаемый тип' })
  @ApiServiceUnavailableResponse({
    description:
      'Хранилище не настроено, MinIO/S3 недоступен или перегружен (503)',
  })
  @UseInterceptors(fileInterceptor)
  async uploadPrivate(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.filesService.upload(file, 'private');
  }

  @Get('public/:filename')
  @ApiOperation({
    summary: 'Получить публичный файл',
    description: 'Имя файла — из ответа POST /files/public (`filename`).',
  })
  @ApiParam({
    name: 'filename',
    example: 'uploads-550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  @ApiProduces('application/octet-stream', 'image/jpeg', 'image/png')
  @ApiOkResponse({
    description: 'Тело файла',
    schema: { type: 'string', format: 'binary' },
  })
  async downloadPublic(
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const { body, contentType } = await this.filesService.getObjectStream(
      'public',
      filename,
    );
    return new StreamableFile(body, {
      type: contentType,
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get('private/:filename')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Получить приватный файл',
    description:
      'Имя файла — из ответа POST /files/private. Требуется **Bearer access**.',
  })
  @ApiParam({
    name: 'filename',
    example: 'uploads-550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  @ApiProduces('application/octet-stream', 'image/jpeg', 'image/png')
  @ApiOkResponse({
    description: 'Тело файла',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiUnauthorizedResponse({ description: 'Нет или невалидный access token' })
  async downloadPrivate(
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const { body, contentType } = await this.filesService.getObjectStream(
      'private',
      filename,
    );
    return new StreamableFile(body, {
      type: contentType,
      disposition: `inline; filename="${filename}"`,
    });
  }
}
