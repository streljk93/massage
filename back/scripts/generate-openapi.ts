/**
 * Генерирует `openapi/openapi.json` без запущенного HTTP-сервера.
 * Требуется валидный DATABASE_URL (см. PrismaService), т.к. поднимается полный AppModule.
 */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { createOpenApiDocument } from '../src/swagger/openapi-document';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const document = createOpenApiDocument(app);
  const outPath = join(process.cwd(), 'openapi/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  console.info(`OpenAPI written to ${outPath}`);
}

void main();
