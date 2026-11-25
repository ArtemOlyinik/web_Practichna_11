import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { AutoPartsService } from './auto-parts.service.js';
import { PartCondition, type AutoPartEntity } from './entities/auto-part.entity.js';
import type { CarModelEntity } from './entities/car-model.entity.js';
import type { CompatibilityCodeEntity } from './entities/compatibility-code.entity.js';
import type { SpecificationEntity } from './entities/specification.entity.js';

interface ServiceMocks {
  autoPartsRepo: Partial<Repository<AutoPartEntity>>;
  carModelsRepo: Partial<Repository<CarModelEntity>>;
  specificationsRepo: Partial<Repository<SpecificationEntity>>;
  compatibilityCodesRepo: Partial<Repository<CompatibilityCodeEntity>>;
  dataSource: {
    manager: Partial<EntityManager>;
    transaction?: (callback: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>;
  };
}

const createService = (mocks: Partial<ServiceMocks> = {}): AutoPartsService => {
  const defaults: ServiceMocks = {
    autoPartsRepo: {},
    carModelsRepo: {},
    specificationsRepo: {},
    compatibilityCodesRepo: {},
    dataSource: { manager: {} },
  };
  const merged = { ...defaults, ...mocks };

  return new AutoPartsService(
    merged.autoPartsRepo as Repository<AutoPartEntity>,
    merged.carModelsRepo as Repository<CarModelEntity>,
    merged.specificationsRepo as Repository<SpecificationEntity>,
    merged.compatibilityCodesRepo as Repository<CompatibilityCodeEntity>,
    merged.dataSource as unknown as DataSource,
  );
};

const carModel = {
  id: '3f1c2b7a-9d4e-4a61-8b2f-1c7d5e9a0b3c',
  brand: 'Toyota',
  name: 'Camry XV70',
  yearFrom: 2017,
  yearTo: 2024,
} as CarModelEntity;

const buildPart = (overrides: Partial<AutoPartEntity> = {}): AutoPartEntity =>
  ({
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    title: 'Гальмівні колодки передні Brembo P85020',
    price: 2450.5,
    oemCode: 'P85020',
    condition: PartCondition.New,
    carModel,
    specifications: [],
    compatibilityCode: null,
    ...overrides,
  }) as AutoPartEntity;

describe('AutoPartsService', () => {
  describe('findAll', () => {
    it('повертає сторінку даних і метадані пагінації', async () => {
      const data = [{ id: 'part-1' }] as AutoPartEntity[];
      const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        distinct: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([data, 3]),
      };
      const service = createService({
        autoPartsRepo: {
          createQueryBuilder: vi.fn().mockReturnValue(qb),
        },
      });

      const result = await service.findAll({ page: 2, limit: 2 });

      expect(result).toEqual({ data, total: 3, page: 2, totalPages: 2 });
      expect(qb.skip).toHaveBeenCalledWith(2);
      expect(qb.take).toHaveBeenCalledWith(2);
    });

    it('фільтрує за характеристикою через innerJoinAndSelect', async () => {
      const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        distinct: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      const service = createService({
        autoPartsRepo: {
          createQueryBuilder: vi.fn().mockReturnValue(qb),
        },
      });

      await service.findAll({ page: 1, limit: 10, specification: 'Підвіска' });

      expect(qb.innerJoinAndSelect).toHaveBeenCalledWith(
        'part.specifications',
        'specification',
        'specification.name ILIKE :specification',
        { specification: '%Підвіска%' },
      );
      expect(qb.distinct).toHaveBeenCalledWith(true);
    });
  });

  describe('create', () => {
    it('створює запчастину, зберігає її та повертає повний запис', async () => {
      const saved = buildPart();
      const create = vi.fn().mockImplementation((dto) => ({ ...dto }));
      const save = vi.fn().mockResolvedValue(saved);
      const findOne = vi.fn().mockResolvedValue(saved);
      const service = createService({
        autoPartsRepo: { create, save, findOne },
        carModelsRepo: { findOneBy: vi.fn().mockResolvedValue(carModel) },
      });

      const dto = {
        title: 'Гальмівні колодки передні Brembo P85020',
        price: 2450.5,
        oemCode: 'P85020',
        condition: PartCondition.New,
        carModelId: carModel.id,
      };
      const result = await service.create(dto);

      expect(create).toHaveBeenCalledWith({
        title: dto.title,
        price: dto.price,
        oemCode: dto.oemCode,
        condition: dto.condition,
        carModel,
        specifications: [],
      });
      expect(save).toHaveBeenCalledTimes(1);
      expect(findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: saved.id },
          relations: expect.objectContaining({ carModel: true }),
        }),
      );
      expect(result).toEqual(saved);
    });

    it('кидає NotFoundException, якщо модель авто не знайдена', async () => {
      const service = createService({
        autoPartsRepo: { create: vi.fn(), save: vi.fn() },
        carModelsRepo: { findOneBy: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.create({
          title: 'Невідома деталь',
          price: 500,
          oemCode: 'UNKNOWN1',
          condition: PartCondition.New,
          carModelId: 'missing-model',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('повертає запчастину за коректним ID', async () => {
      const part = buildPart();
      const service = createService({
        autoPartsRepo: { findOne: vi.fn().mockResolvedValue(part) },
      });

      await expect(service.findOne(part.id)).resolves.toEqual(part);
    });

    it('кидає NotFoundException, якщо запчастину не знайдено', async () => {
      const service = createService({
        autoPartsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAggregate', () => {
    it('завантажує запчастину разом із моделлю, вузлами та кодом сумісності', async () => {
      const part = buildPart();
      const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(part),
      };
      const service = createService({
        autoPartsRepo: { createQueryBuilder: vi.fn().mockReturnValue(qb) },
      });

      await expect(service.findAggregate(part.id)).resolves.toEqual(part);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(3);
    });

    it('кидає NotFoundException для відсутнього агрегата', async () => {
      const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      };
      const service = createService({
        autoPartsRepo: { createQueryBuilder: vi.fn().mockReturnValue(qb) },
      });

      await expect(service.findAggregate('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('оновлює поля запчастини та повертає свіжий запис', async () => {
      const item = buildPart();
      const updated = buildPart({ title: 'Оновлена назва' });
      const save = vi.fn().mockResolvedValue(updated);
      const service = createService({
        autoPartsRepo: {
          findOneBy: vi.fn().mockResolvedValue(item),
          save,
          findOne: vi.fn().mockResolvedValue(updated),
        },
      });

      const result = await service.update(item.id, { title: 'Оновлена назва' });

      expect(item.title).toBe('Оновлена назва');
      expect(save).toHaveBeenCalledWith(item);
      expect(result).toEqual(updated);
    });

    it('кидає NotFoundException, якщо оновлюваної запчастини немає', async () => {
      const service = createService({
        autoPartsRepo: { findOneBy: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.update('missing-id', { title: 'Без власника' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('виконує мʼяке видалення після перевірки наявності', async () => {
      const part = buildPart();
      const softDelete = vi.fn().mockResolvedValue({ affected: 1 });
      const service = createService({
        autoPartsRepo: {
          findOne: vi.fn().mockResolvedValue(part),
          softDelete,
        },
      });

      await service.remove(part.id);

      expect(softDelete).toHaveBeenCalledWith(part.id);
    });
  });

  describe('restore', () => {
    it('відновлює запчастину та повертає її', async () => {
      const part = buildPart();
      const service = createService({
        autoPartsRepo: {
          restore: vi.fn().mockResolvedValue({ affected: 1 }),
          findOne: vi.fn().mockResolvedValue(part),
        },
      });

      await expect(service.restore(part.id)).resolves.toEqual(part);
    });

    it('кидає NotFoundException, якщо відновлювати нічого', async () => {
      const service = createService({
        autoPartsRepo: { restore: vi.fn().mockResolvedValue({ affected: 0 }) },
      });

      await expect(service.restore('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createTransactional', () => {
    const buildManager = (part: AutoPartEntity): Partial<EntityManager> => {
      let saved = false;
      return {
        findOneBy: vi.fn().mockResolvedValue(carModel),
        create: vi.fn().mockImplementation((_entity, data) => data),
        save: vi.fn().mockImplementation(async (value) => {
          if (!saved && value && typeof value === 'object') {
            saved = true;
            return { id: part.id, ...value };
          }
          return value;
        }),
        findOne: vi.fn().mockResolvedValue(part),
      };
    };

    it('створює запчастину, код сумісності та вузли в одній транзакції', async () => {
      const part = buildPart();
      const manager = buildManager(part);
      const service = createService({
        dataSource: {
          manager: {},
          transaction: vi.fn(async (callback) =>
            callback(manager as EntityManager),
          ),
        },
      });

      const result = await service.createTransactional({
        title: part.title,
        price: part.price,
        oemCode: part.oemCode,
        condition: part.condition,
        carModelId: carModel.id,
        compatibilityCode: { code: 'P85020-OEM', manufacturer: 'Brembo' },
      });

      expect(result).toEqual(part);
      expect(manager.save).toHaveBeenCalled();
      expect(manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ where: { id: part.id } }),
      );
    });

    it('відхиляє створення з ціною менше 100 грн', async () => {
      const manager = buildManager(buildPart());
      const service = createService({
        dataSource: {
          manager: {},
          transaction: vi.fn(async (callback) =>
            callback(manager as EntityManager),
          ),
        },
      });

      await expect(
        service.createTransactional({
          title: 'Дешева деталь',
          price: 50,
          oemCode: 'CHEAP01',
          condition: PartCondition.New,
          carModelId: carModel.id,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('updateTransactional', () => {
    it('оновлює агрегат і підключає наявні та нові вузли', async () => {
      const part = buildPart();
      const existingSpec = { id: 'spec-1', name: 'Підвіска' };
      const manager: Partial<EntityManager> = {
        findOne: vi
          .fn()
          .mockResolvedValueOnce(part)
          .mockResolvedValueOnce({ ...part, title: 'Оновлена назва' }),
        save: vi.fn().mockImplementation(async (value) => value),
        getRepository: vi.fn().mockReturnValue({
          find: vi.fn().mockResolvedValue([existingSpec]),
          create: vi.fn().mockImplementation((data) => data),
        }),
      };
      const service = createService({
        dataSource: {
          manager: {},
          transaction: vi.fn(async (callback) =>
            callback(manager as EntityManager),
          ),
        },
      });

      const result = await service.updateTransactional(part.id, {
        title: 'Оновлена назва',
        specificationNames: ['Підвіска', 'Електрика'],
      });

      expect(part.title).toBe('Оновлена назва');
      expect(part.specifications).toEqual([
        existingSpec,
        { name: 'Електрика' },
      ]);
      expect(manager.save).toHaveBeenCalledWith(part);
      expect(result.title).toBe('Оновлена назва');
    });

    it('кидає NotFoundException, якщо агрегата немає', async () => {
      const manager: Partial<EntityManager> = {
        findOne: vi.fn().mockResolvedValue(null),
      };
      const service = createService({
        dataSource: {
          manager: {},
          transaction: vi.fn(async (callback) =>
            callback(manager as EntityManager),
          ),
        },
      });

      await expect(
        service.updateTransactional('missing-id', { title: 'Без власника' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('upsertCompatibilityCode', () => {
    it('оновлює наявний код сумісності', async () => {
      const part = buildPart();
      const existing = {
        id: 'code-1',
        code: 'OLD-CODE',
        manufacturer: 'Brembo',
        isInterchangeable: false,
        notes: null,
      };
      const save = vi.fn().mockImplementation(async (value) => value);
      const service = createService({
        autoPartsRepo: { findOneBy: vi.fn().mockResolvedValue(part) },
        compatibilityCodesRepo: {
          findOne: vi.fn().mockResolvedValue(existing),
          save,
        },
      });

      const result = await service.upsertCompatibilityCode(part.id, {
        code: 'P85020-OEM',
        manufacturer: 'Brembo',
        isInterchangeable: true,
      });

      expect(existing.code).toBe('P85020-OEM');
      expect(existing.isInterchangeable).toBe(true);
      expect(save).toHaveBeenCalledWith(existing);
      expect(result).toBe(existing);
    });

    it('створює код сумісності, якщо його ще немає', async () => {
      const part = buildPart();
      const created = { id: 'code-2', code: 'P85020-OEM' };
      const create = vi.fn().mockReturnValue(created);
      const service = createService({
        autoPartsRepo: { findOneBy: vi.fn().mockResolvedValue(part) },
        compatibilityCodesRepo: {
          findOne: vi.fn().mockResolvedValue(null),
          create,
          save: vi.fn().mockResolvedValue(created),
        },
      });

      const result = await service.upsertCompatibilityCode(part.id, {
        code: 'P85020-OEM',
        manufacturer: 'Brembo',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ autoPart: part, code: 'P85020-OEM' }),
      );
      expect(result).toEqual(created);
    });

    it('кидає NotFoundException, якщо запчастини немає', async () => {
      const service = createService({
        autoPartsRepo: { findOneBy: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.upsertCompatibilityCode('missing-id', {
          code: 'P85020-OEM',
          manufacturer: 'Brembo',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
