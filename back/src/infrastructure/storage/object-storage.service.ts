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

    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`MinIO/S3: создан бакет «${this.bucket}»`);
    }
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
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObjectStream(
    key: string,
  ): Promise<{ body: Readable; contentType: string }> {
    this.assertConfigured();
    const out = await this.client!.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const stream = out.Body;
    if (!stream || typeof (stream as Readable).pipe !== 'function') {
      throw new Error('S3 GetObject: empty body');
    }
    return {
      body: stream as Readable,
      contentType: out.ContentType ?? 'application/octet-stream',
    };
  }
}
