import { Test, type TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: {
    findAllCarModels: ReturnType<typeof vi.fn>;
    createCarModel: ReturnType<typeof vi.fn>;
    findAllSpecifications: ReturnType<typeof vi.fn>;
    createSpecification: ReturnType<typeof vi.fn>;
    removeCarModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      findAllCarModels: vi.fn().mockResolvedValue([{ id: 'model-1' }]),
      createCarModel: vi.fn().mockResolvedValue({ id: 'model-1' }),
      findAllSpecifications: vi.fn().mockResolvedValue([{ id: 'spec-1' }]),
      createSpecification: vi.fn().mockResolvedValue({ id: 'spec-1' }),
      removeCarModel: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: service }],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  it('повертає довідник моделей авто', async () => {
    await expect(controller.findCarModels()).resolves.toEqual([{ id: 'model-1' }]);
    expect(service.findAllCarModels).toHaveBeenCalled();
  });

  it('створює модель авто', async () => {
    const dto = { name: 'Camry XV70', brand: 'Toyota', yearFrom: 2017 };
    await expect(controller.createCarModel(dto)).resolves.toEqual({ id: 'model-1' });
    expect(service.createCarModel).toHaveBeenCalledWith(dto);
  });

  it('повертає довідник вузлів', async () => {
    await expect(controller.findSpecifications()).resolves.toEqual([{ id: 'spec-1' }]);
    expect(service.findAllSpecifications).toHaveBeenCalled();
  });

  it('створює вузол', async () => {
    const dto = { name: 'Підвіска' };
    await expect(controller.createSpecification(dto)).resolves.toEqual({ id: 'spec-1' });
    expect(service.createSpecification).toHaveBeenCalledWith(dto);
  });

  it('видаляє модель авто', async () => {
    await expect(controller.removeCarModel('model-1')).resolves.toBeUndefined();
    expect(service.removeCarModel).toHaveBeenCalledWith('model-1');
  });
});
