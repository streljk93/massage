import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ObjectStorageService } from '../../../infrastructure/storage/object-storage.service';

export type FileVisibility = 'public' | 'private';

/** Фото для витрины/аватаров: как у типичных маркетплейсов — JPEG, PNG, WebP (без GIF и без PDF). */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));

/** Имя файла внутри префикса public|private (один сегмент URL). */
const STORAGE_FILENAME_RE = /^[a-zA-Z0-9._-]{8,240}$/;

@Injectable()
export class FilesService {
  constructor(private readonly objectStorage: ObjectStorageService) {}

  assertFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
  }

  validateMimeType(mimetype: string): void {
    if (!ALLOWED_MIME.has(mimetype)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `Allowed types: ${[...ALLOWED_MIME].join(', ')}`,
      });
    }
  }

  buildFilename(mimetype: string): string {
    const ext = MIME_TO_EXT[mimetype] ?? '.bin';
    return `uploads-${randomUUID()}${ext}`;
  }

  objectKey(visibility: FileVisibility, filename: string): string {
    if (!STORAGE_FILENAME_RE.test(filename)) {
      throw new NotFoundException();
    }
    return `${visibility}/${filename}`;
  }

  assertValidFilenameParam(filename: string): void {
    if (!STORAGE_FILENAME_RE.test(filename)) {
      throw new NotFoundException();
    }
  }

  async upload(
    file: Express.Multer.File | undefined,
    visibility: FileVisibility,
  ): Promise<{
    visibility: FileVisibility;
    key: string;
    filename: string;
    url: string;
    contentType: string;
    size: number;
  }> {
    this.objectStorage.assertConfigured();
    this.assertFile(file);
    this.validateMimeType(file.mimetype);

    const filename = this.buildFilename(file.mimetype);
    const key = this.objectKey(visibility, filename);
    await this.objectStorage.putObject(key, file.buffer, file.mimetype);

    return {
      visibility,
      key,
      filename,
      url: `/v1/files/${visibility}/${filename}`,
      contentType: file.mimetype,
      size: file.buffer.length,
    };
  }

  async getObjectStream(
    visibility: FileVisibility,
    filename: string,
  ): Promise<{ body: Readable; contentType: string }> {
    this.assertValidFilenameParam(filename);
    const key = `${visibility}/${filename}`;
    try {
      return await this.objectStorage.getObjectStream(key);
    } catch (e: unknown) {
      const err = e as {
        name?: string;
        Code?: string;
        $metadata?: { httpStatusCode?: number };
      };
      const code = err.name ?? err.Code;
      if (
        code === 'NoSuchKey' ||
        code === 'NotFound' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException();
      }
      throw e;
    }
  }
}
