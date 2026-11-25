import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { GlobalExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { TrimPipe } from './../src/common/pipes/trim.pipe.js';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

interface CarModel {
  id: string;
  brand: string;
  name: string;
}

interface AutoPartResponse {
  id: string;
  title: string;
  price: number;
  oemCode: string;
  condition: string;
  carModel: CarModel;
}

describe('AutoPartsController (e2e)', () => {
  let app: INestApplication<App>;
  let mechanicToken: string;
  let carModelId: string;
  let createdPartId: string | undefined;

  const validBody = () => ({
    title: 'Гальмівні колодки передні Brembo P85020 (E2E)',
    price: 2450.5,
    oemCode: `E2E${Date.now().toString(36).toUpperCase()}`,
    condition: 'NEW',
    carModelId,
    specificationNames: ['Гальмівна система'],
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new TrimPipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    const modelsResponse = await request(app.getHttpServer())
      .get('/car-models')
      .expect(200);
    carModelId = (modelsResponse.body as CarModel[])[0].id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'mechanic@autoparts.local', password: 'Mechanic12345' })
      .expect(200);
    mechanicToken = (loginResponse.body as LoginResponse).accessToken;
  });

  afterAll(async () => {
    if (createdPartId) {
      await request(app.getHttpServer())
        .delete(`/auto-parts/${createdPartId}`)
        .set('Authorization', `Bearer ${mechanicToken}`);
    }
    await app.close();
  });

  it('GET /auto-parts - публічний список доступний без токена [200]', async () => {
    const response = await request(app.getHttpServer())
      .get('/auto-parts?page=1&limit=5')
      .expect(200);

    const body = response.body as {
      data: AutoPartResponse[];
      total: number;
      page: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
  });

  it('POST /auto-parts - створення з валідними даними [201 Created]', async () => {
    const payload = validBody();
    const response = await request(app.getHttpServer())
      .post('/auto-parts')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send(payload)
      .expect(201);

    const body = response.body as AutoPartResponse;
    expect(body.id).toBeDefined();
    expect(body.oemCode).toBe(payload.oemCode);
    expect(body.title).toBe(payload.title);
    expect(body.carModel.id).toBe(carModelId);
    createdPartId = body.id;
  });

  it('POST /auto-parts - короткий OEM-код відхилено [400 Bad Request]', async () => {
    const response = await request(app.getHttpServer())
      .post('/auto-parts')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ ...validBody(), oemCode: 'AB12', price: -10 })
      .expect(400);

    const body = response.body as { success: boolean; message: string[] };
    expect(body.success).toBe(false);
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message.join(' ')).toMatch(/oemCode/);
    expect(body.message.join(' ')).toMatch(/price/);
  });

  it('POST /auto-parts - без JWT-токена доступ заборонено [401 Unauthorized]', async () => {
    const response = await request(app.getHttpServer())
      .post('/auto-parts')
      .send(validBody())
      .expect(401);

    expect((response.body as { statusCode: number }).statusCode).toBe(401);
  });
});
