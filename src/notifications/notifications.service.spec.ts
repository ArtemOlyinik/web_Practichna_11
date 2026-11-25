import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AutoPartsService } from '../auto-parts/auto-parts.service.js';
import { PartRequestEntity, PartRequestStatus } from './entities/part-request.entity.js';
import type { EventsGateway } from './events.gateway.js';
import type { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';

const VIN = 'WVWZZZ1JZXW000001';

function buildRequest(): PartRequestEntity {
  return {
    id: 'request-1',
    vinCode: VIN,
    customerEmail: 'client@example.com',
    requestedPart: 'Стартер',
    description: null,
    status: PartRequestStatus.InReview,
    foundPart: null,
    managerNote: null,
    notifiedAt: null,
    createdAt: new Date('2026-11-18T10:00:00.000Z'),
    updatedAt: new Date('2026-11-18T10:00:00.000Z'),
  };
}

const part = {
  id: 'part-1',
  title: 'Стартер Bosch 0001108231',
  oemCode: '0001108231',
  price: 4300,
  condition: 'REFURBISHED',
  carModel: { brand: 'BMW', name: '3 Series G20' },
};

function buildRepos() {
  const qb = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi
      .fn()
      .mockResolvedValue([{ status: PartRequestStatus.InReview, count: '2' }]),
  };

  const requestsRepo = {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({
      ...value,
      id: value.id ?? 'request-created',
      createdAt: value.createdAt ?? new Date('2026-11-18T11:00:00.000Z'),
      updatedAt: value.updatedAt ?? new Date('2026-11-18T11:00:00.000Z'),
    })),
    createQueryBuilder: vi.fn(() => qb),
  };

  return { requestsRepo, qb };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let requestsRepo: ReturnType<typeof buildRepos>['requestsRepo'];
  let autoPartsService: { findOne: ReturnType<typeof vi.fn> };
  let gateway: { emitToRoom: ReturnType<typeof vi.fn>; roomList: unknown[]; activeConnections: number };
  let mail: {
    sendNotificationEmail: ReturnType<typeof vi.fn>;
    getSentCount: ReturnType<typeof vi.fn>;
    getLastSentAt: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const built = buildRepos();
    requestsRepo = built.requestsRepo;
    autoPartsService = { findOne: vi.fn().mockResolvedValue(part) };
    gateway = {
      emitToRoom: vi.fn().mockReturnValue(1),
      roomList: [],
      activeConnections: 0,
    };
    mail = {
      sendNotificationEmail: vi.fn().mockResolvedValue({
        to: 'client@example.com',
        subject: 'Підбір за VIN',
        messageId: '<mail-1@autoparts.local>',
        accepted: ['client@example.com'],
        sentAt: '2026-11-18T12:00:00.000Z',
      }),
      getSentCount: vi.fn().mockReturnValue(1),
      getLastSentAt: vi.fn().mockReturnValue('2026-11-18T12:00:00.000Z'),
    };

    service = new NotificationsService(
      requestsRepo as unknown as Repository<PartRequestEntity>,
      autoPartsService as unknown as AutoPartsService,
      gateway as unknown as EventsGateway,
      mail as unknown as MailService,
    );
  });

  it('створює заявку, нормалізує VIN і надсилає подію в кімнату', async () => {
    requestsRepo.findOneBy.mockResolvedValue(null);

    const created = await service.create({
      vinCode: VIN.toLowerCase(),
      customerEmail: ' Client@Example.com ',
      requestedPart: ' Стартер ',
    });

    expect(created.vinCode).toBe(VIN);
    expect(created.status).toBe(PartRequestStatus.New);
    expect(gateway.emitToRoom).toHaveBeenCalledWith(
      `request_${VIN}`,
      'requestCreated',
      expect.objectContaining({ vinCode: VIN }),
    );
  });

  it('не створює дубль заявки для одного VIN', async () => {
    requestsRepo.findOneBy.mockResolvedValue(buildRequest());

    await expect(
      service.create({
        vinCode: VIN,
        customerEmail: 'client@example.com',
        requestedPart: 'Стартер',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('кидає NotFoundException для невідомого VIN', async () => {
    requestsRepo.findOne.mockResolvedValue(null);

    await expect(service.findByVin(VIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('публікує результат: подія в кімнату, лист і оновлений статус', async () => {
    const request = buildRequest();
    requestsRepo.findOne.mockResolvedValue(request);

    const result = await service.publishResult(VIN, {
      status: PartRequestStatus.PartFound,
      foundPartId: 'part-1',
      managerNote: 'Сумісність підтверджена',
    });

    expect(autoPartsService.findOne).toHaveBeenCalledWith('part-1');
    expect(gateway.emitToRoom).toHaveBeenCalledWith(
      `request_${VIN}`,
      'partFound',
      expect.objectContaining({
        vinCode: VIN,
        status: PartRequestStatus.PartFound,
        part: expect.objectContaining({ oemCode: '0001108231' }),
      }),
    );
    expect(mail.sendNotificationEmail).toHaveBeenCalledWith(
      'client@example.com',
      expect.stringContaining(VIN),
      expect.stringContaining('Стартер Bosch 0001108231'),
    );
    expect(result.success).toBe(true);
    expect(result.notification.receivers).toBe(1);
    expect(result.email.messageId).toBe('<mail-1@autoparts.local>');
    expect(result.request.status).toBe(PartRequestStatus.PartFound);
  });

  it('не публікує PART_FOUND без вибраної запчастини', async () => {
    requestsRepo.findOne.mockResolvedValue(buildRequest());

    await expect(
      service.publishResult(VIN, { status: PartRequestStatus.PartFound }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(gateway.emitToRoom).not.toHaveBeenCalled();
    expect(mail.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('надсилає повідомлення про відмову без даних запчастини', async () => {
    requestsRepo.findOne.mockResolvedValue(buildRequest());

    const result = await service.publishResult(VIN, {
      status: PartRequestStatus.Rejected,
      managerNote: 'Сумісних аналогів немає в наявності',
    });

    expect(gateway.emitToRoom).toHaveBeenCalledWith(
      `request_${VIN}`,
      'requestRejected',
      expect.objectContaining({ part: null }),
    );
    expect(result.success).toBe(true);
  });

  it('збирає знімок стану для SSE', async () => {
    gateway.roomList = [{ roomId: `request_${VIN}`, members: 2 }];
    gateway.activeConnections = 3;
    await service.onModuleInit();

    const status = service.getStatus();

    expect(status).toMatchObject({
      serverStatus: 'ONLINE',
      activeConnections: 3,
      rooms: [{ roomId: `request_${VIN}`, members: 2 }],
      emailsSent: 1,
    });
    expect(status.partRequests).toMatchObject({ total: 2, inReview: 2 });
  });
});
