import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  createOpenApiDocument,
  mountSwaggerUi,
} from './swagger/openapi-document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3001;
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix('v1');

  const openApiDocument = createOpenApiDocument(app);
  mountSwaggerUi(app, openApiDocument);

  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
