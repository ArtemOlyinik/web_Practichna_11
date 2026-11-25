import { Test, type TestingModule } from '@nestjs/testing';
import { RequestIdService } from '../shared/request-id.service.js';
import { AutoPartsController } from './auto-parts.controller.js';
import { AutoPartsService } from './auto-parts.service.js';
import { PartCondition, type AutoPartEntity } from './entities/auto-part.entity.js';

const part = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  title: 'Гальмівні колодки передні Brembo P85020',
  price: 2450.5,
  oemCode: 'P85020',
  condition: PartCondition.New,
} as AutoPartEntity;

type MockService = Record<
  | 'findAll'
  | 'findOne'
  | 'findAggregate'
  | 'create'
  | 'createTransactional'
  | 'update'
  | 'updateTransactional'
  | 'upsertCompatibilityCode'
  | 'restore'
  | 'remove',
  ReturnType<typeof vi.fn>
>;

describe('AutoPartsController', () => {
  let controller: AutoPartsController;
  let service: MockService;

  beforeEach(async () => {
    service = {
      findAll: vi.fn().mockResolvedValue({ data: [part], total: 1, page: 1, totalPages: 1 }),
      findOne: vi.fn().mockResolvedValue(part),
      findAggregate: vi.fn().mockResolvedValue(part),
      create: vi.fn().mockResolvedValue(part),
      createTransactional: vi.fn().mockResolvedValue(part),
      update: vi.fn().mockResolvedValue(part),
      updateTransactional: vi.fn().mockResolvedValue(part),
      upsertCompatibilityCode: vi.fn().mockResolvedValue({ id: 'code-1' }),
      restore: vi.fn().mockResolvedValue(part),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutoPartsController],
      providers: [
        { provide: AutoPartsService, useValue: service },
        { provide: RequestIdService, useValue: { getId: () => 'request-1' } },
      ],
    }).compile();

    controller = module.get<AutoPartsController>(AutoPartsController);
  });

  it('повертає список запчастин із параметрами пагінації', async () => {
    const query = { page: 1, limit: 10, search: 'колодки' };

    await expect(controller.findAll(query)).resolves.toEqual({
      data: [part],
      total: 1,
      page: 1,
      totalPages: 1,
    });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('передає ID у сервіс під час пошуку однієї запчастини', async () => {
    await expect(controller.findOne(part.id)).resolves.toEqual(part);
    expect(service.findOne).toHaveBeenCalledWith(part.id);
  });

  it('завантажує повний агрегат запчастини', async () => {
    await expect(controller.findAggregate(part.id)).resolves.toEqual(part);
    expect(service.findAggregate).toHaveBeenCalledWith(part.id);
  });

  it('створює запчастину через сервіс', async () => {
    const dto = {
      title: part.title,
      price: part.price,
      oemCode: part.oemCode,
      condition: part.condition,
      carModelId: '3f1c2b7a-9d4e-4a61-8b2f-1c7d5e9a0b3c',
    };

    await expect(controller.create(dto)).resolves.toEqual(part);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('створює агрегат у транзакції', async () => {
    const dto = {
      title: part.title,
      price: part.price,
      oemCode: part.oemCode,
      condition: part.condition,
      carModelId: '3f1c2b7a-9d4e-4a61-8b2f-1c7d5e9a0b3c',
      compatibilityCode: { code: 'P85020-OEM', manufacturer: 'Brembo' },
    };

    await expect(controller.createTransactional(dto)).resolves.toEqual(part);
    expect(service.createTransactional).toHaveBeenCalledWith(dto);
  });

  it('оновлює запчастину частково', async () => {
    const dto = { price: 2590 };
    await expect(controller.update(part.id, dto)).resolves.toEqual(part);
    expect(service.update).toHaveBeenCalledWith(part.id, dto);
  });

  it('оновлює агрегат у транзакції', async () => {
    const dto = { title: 'Оновлена назва' };
    await expect(controller.updateTransactional(part.id, dto)).resolves.toEqual(part);
    expect(service.updateTransactional).toHaveBeenCalledWith(part.id, dto);
  });

  it('передає код сумісності у сервіс', async () => {
    const dto = { code: 'P85020-OEM', manufacturer: 'Brembo' };
    await expect(controller.upsertCompatibilityCode(part.id, dto)).resolves.toEqual({
      id: 'code-1',
    });
    expect(service.upsertCompatibilityCode).toHaveBeenCalledWith(part.id, dto);
  });

  it('відновлює мʼяко видалену запчастину', async () => {
    await expect(controller.restore(part.id)).resolves.toEqual(part);
    expect(service.restore).toHaveBeenCalledWith(part.id);
  });

  it('видаляє запчастину через сервіс', async () => {
    await expect(controller.remove(part.id)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(part.id);
  });
});
