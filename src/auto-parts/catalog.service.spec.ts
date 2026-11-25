import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { CatalogService } from './catalog.service.js';
import type { CarModelEntity } from './entities/car-model.entity.js';
import type { SpecificationEntity } from './entities/specification.entity.js';

const carModel = {
  id: '3f1c2b7a-9d4e-4a61-8b2f-1c7d5e9a0b3c',
  brand: 'Toyota',
  name: 'Camry XV70',
  yearFrom: 2017,
  yearTo: 2024,
} as CarModelEntity;

const buildService = (
  carModelsRepo: Partial<Repository<CarModelEntity>>,
  specificationsRepo: Partial<Repository<SpecificationEntity>> = {},
): CatalogService =>
  new CatalogService(
    carModelsRepo as Repository<CarModelEntity>,
    specificationsRepo as Repository<SpecificationEntity>,
  );

describe('CatalogService', () => {
  it('повертає моделі авто, відсортовані за маркою та назвою', async () => {
    const find = vi.fn().mockResolvedValue([carModel]);
    const service = buildService({ find });

    await expect(service.findAllCarModels()).resolves.toEqual([carModel]);
    expect(find).toHaveBeenCalledWith({ order: { brand: 'ASC', name: 'ASC' } });
  });

  it('створює модель авто з роком завершення випуску', async () => {
    const create = vi.fn().mockImplementation((data) => data);
    const save = vi.fn().mockResolvedValue(carModel);
    const service = buildService({ create, save });

    const dto = {
      name: 'Camry XV70',
      brand: 'Toyota',
      yearFrom: 2017,
      yearTo: 2024,
    };
    await expect(service.createCarModel(dto)).resolves.toEqual(carModel);
    expect(create).toHaveBeenCalledWith(dto);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('підставляє null, якщо рік завершення не вказано', async () => {
    const create = vi.fn().mockImplementation((data) => data);
    const save = vi.fn().mockResolvedValue(carModel);
    const service = buildService({ create, save });

    await service.createCarModel({
      name: 'Camry XV70',
      brand: 'Toyota',
      yearFrom: 2017,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ yearTo: null }),
    );
  });

  it('повертає вузли, відсортовані за назвою', async () => {
    const find = vi.fn().mockResolvedValue([{ name: 'Підвіска' }]);
    const service = buildService({}, { find });

    await expect(service.findAllSpecifications()).resolves.toEqual([
      { name: 'Підвіска' },
    ]);
    expect(find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('створює вузол із порожнім описом', async () => {
    const create = vi.fn().mockImplementation((data) => data);
    const save = vi.fn().mockResolvedValue({ id: 'spec-1', name: 'Підвіска' });
    const service = buildService({}, { create, save });

    await service.createSpecification({ name: 'Підвіска' });

    expect(create).toHaveBeenCalledWith({ name: 'Підвіска', description: null });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('видаляє модель авто за ID', async () => {
    const deleteFn = vi.fn().mockResolvedValue({ affected: 1 });
    const service = buildService({ delete: deleteFn });

    await expect(service.removeCarModel(carModel.id)).resolves.toBeUndefined();
    expect(deleteFn).toHaveBeenCalledWith(carModel.id);
  });

  it('кидає NotFoundException, якщо модель уже видалена', async () => {
    const service = buildService({
      delete: vi.fn().mockResolvedValue({ affected: 0 }),
    });

    await expect(service.removeCarModel('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
