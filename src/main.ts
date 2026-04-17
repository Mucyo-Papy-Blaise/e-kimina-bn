import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { appConfig } from './config/app.config';

type AppConfig = ReturnType<typeof appConfig>;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const logger = new Logger('Bootstrap');
  const apiPrefix = configService.get('app.apiPrefix', { infer: true });
  const port = configService.get('app.port', { infer: true });
  const swaggerEnabled = configService.get('app.swaggerEnabled', {
    infer: true,
  });

  app.setGlobalPrefix(apiPrefix);

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new PrismaClientExceptionFilter());
  app.enableShutdownHooks();

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(configService.get('app.name', { infer: true }))
        .setDescription(
          'Backend API for the E-kimina platform built with NestJS, Prisma, and TypeScript.',
        )
        .setVersion(configService.get('app.version', { infer: true }))
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Paste a valid JWT access token.',
          },
          'JWT-auth',
        )
        // Do not add `.addServer('/api')` here: paths already include the global
        // prefix, and an extra server base would produce `/api/api/...` in Swagger UI.
        .build(),
    );

    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(port);
  logger.log(`HTTP server listening on port ${port}`);
}

void bootstrap();
