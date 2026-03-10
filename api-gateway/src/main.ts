import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // CORS — allow all origins for a public-facing API
  app.enableCors();

  // Swagger UI at /docs
  const config = new DocumentBuilder()
    .setTitle('RetroStore Public API')
    .setDescription('Public API gateway for NakamaRetroStore — games, achievements, leaderboard')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`RetroStore API Gateway running on port ${port}`);
}

bootstrap();
