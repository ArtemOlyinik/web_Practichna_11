import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { TimingInterceptor } from './common/interceptors/timing.interceptor.js';
import { TrimPipe } from './common/pipes/trim.pipe.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(
    new TrimPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TimingInterceptor());

  /**
   * Специфікація OpenAPI 3.0 будується з декораторів контролерів і DTO.
   * Інтерактивна сторінка доступна за /api/docs, машинозчитуваний
   * JSON - за /api/docs-json.
   */
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AutoParts UA API')
    .setDescription(
      'Офіційна технічна документація REST API онлайн-магазину автозапчастин. ' +
        'Каталог підтримує фільтрацію за моделлю авто, вузлом і ціною, ' +
        'привілейовані операції закриті JWT-авторизацією з ролями ADMIN і MECHANIC.',
    )
    .setVersion('1.0')
    .setContact('AutoParts UA', 'https://github.com/ArtemOlyinik', 'support@autoparts.local')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Access-токен, отриманий через POST /auth/login. Натисніть Authorize і вставте токен без префікса Bearer.',
    })
    .addTag('Автозапчастини та вузли', 'Каталог, пошук, сумісність і CRUD-операції')
    .addTag('Довідники', 'Моделі автомобілів і вузли/агрегати')
    .addTag('Автентифікація', 'Реєстрація, вхід, оновлення токенів і профіль')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  /**
   * Клієнтський тестовий інтерфейс лежить у public/ і відкривається
   * за адресою http://localhost:3000/client.html.
   */
  app.useStaticAssets(join(process.cwd(), 'public'));

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
