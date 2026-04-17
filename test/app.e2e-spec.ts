import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaClientExceptionFilter } from '../src/common/filters/prisma-client-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  type HealthResponse = {
    status: string;
    database: string;
  };

  const prismaServiceMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new PrismaClientExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer()).get('/api').expect(200).expect({
      name: 'nest-app',
      version: '0.0.1',
      environment: 'test',
      docsPath: '/api/docs',
    });
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as HealthResponse;

        expect(body.status).toBe('ok');
        expect(body.database).toBe('up');
      });
  });
});
