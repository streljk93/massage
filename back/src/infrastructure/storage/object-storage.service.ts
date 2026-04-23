import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';

function isBucketMissingError(err: unknown): boolean {
  const e = err as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = String(e.name ?? e.Code ?? '');
  if (code === 'NotFound' || code === 'NoSuchBucket') {
    return true;
  }
  return e.$metadata?.httpStatusCode === 404;
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private client: S3Client | null = null;
  private bucket = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const endpoint = this.config.get<string>('storage.endpoint');
    if (!endpoint) {
      this.logger.warn(
        'S3_ENDPOINT / storage.endpoint пуст — загрузка файлов недоступна',
      );
      return;
    }

    this.bucket =
      this.config.get<string>('storage.bucket') ?? 'services-uploads';
    this.client = new S3Client({
      region: this.config.get<string>('storage.region') ?? 'us-east-1',
      endpoint,
      credentials: {
        accessKeyId:
          this.config.get<string>('storage.accessKey') ?? 'minioadmin',
        secretAccessKey:
          this.config.get<string>('storage.secretKey') ?? 'minioadmin',
      },
      forcePathStyle: true,
    });

    try {
      await this.ensureBucket();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `MinIO/S3: не удалось подключиться или проверить бакет «${this.bucket}» (${msg}). Убедитесь, что хранилище запущено и S3_ENDPOINT верен.`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  /**
   * HeadBucket; CreateBucket только если бакета нет — при сетевом сбое не дублируем лишний запрос.
   */
  private async ensureBucket(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch (headErr: unknown) {
      if (!isBucketMissingError(headErr)) {
        throw headErr;
      }
    }
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    this.logger.log(`MinIO/S3: создан бакет «${this.bucket}»`);
  }

  private throwStorageUnavailable(err: unknown): never {
    const logMsg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`MinIO/S3: ошибка запроса (${logMsg})`);
    throw new ServiceUnavailableException({
      code: 'STORAGE_UNAVAILABLE',
      message:
        'Объектное хранилище временно недоступно. Повторите попытку позже.',
    });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  assertConfigured(): void {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured (set S3_ENDPOINT)',
      });
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    this.assertConfigured();
    try {
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err: unknown) {
      this.throwStorageUnavailable(err);
    }
  }

  async getObjectStream(
    key: string,
  ): Promise<{ body: Readable; contentType: string }> {
    this.assertConfigured();
    try {
      const out = await this.client!.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = out.Body;
      if (!stream || typeof (stream as Readable).pipe !== 'function') {
        this.throwStorageUnavailable(new Error('S3 GetObject: empty body'));
      }
      return {
        body: stream as Readable,
        contentType: out.ContentType ?? 'application/octet-stream',
      };
    } catch (err: unknown) {
      const e = err as {
        name?: string;
        Code?: string;
        $metadata?: { httpStatusCode?: number };
      };
      const code = e.name ?? e.Code;
      if (
        code === 'NoSuchKey' ||
        code === 'NotFound' ||
        e.$metadata?.httpStatusCode === 404
      ) {
        throw err;
      }
      this.throwStorageUnavailable(err);
    }
  }
}
