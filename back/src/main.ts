import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3001;
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
