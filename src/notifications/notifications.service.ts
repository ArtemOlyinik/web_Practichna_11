import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AutoPartsService } from '../auto-parts/auto-parts.service.js';
import type { CreatePartRequestDto } from './dto/create-part-request.dto.js';
import type { PartRequestQueryDto } from './dto/part-request-query.dto.js';
import type { UpdatePartRequestStatusDto } from './dto/update-part-request-status.dto.js';
import {
  buildPartFoundEmail,
  partFoundSubject,
  type EmailPartSummary,
} from './email/part-found.template.js';
import { PartRequestEntity, PartRequestStatus } from './entities/part-request.entity.js';
import { EventsGateway, normalizeVin, partRequestRoom } from './events.gateway.js';
import { MailService } from './mail.service.js';

/**
 * Події Socket.IO для кожного стану заявки. Основна подія варіанта 7 -
 * partFound, інші стани мають окремі назви, щоб клієнт міг їх розрізняти.
 */
export const EVENT_BY_STATUS: Record<PartRequestStatus, string> = {
  [PartRequestStatus.New]: 'requestCreated',
  [PartRequestStatus.InReview]: 'requestInReview',
  [PartRequestStatus.PartFound]: 'partFound',
  [PartRequestStatus.Rejected]: 'requestRejected',
};

export const STATUS_LABELS: Record<PartRequestStatus, string> = {
  [PartRequestStatus.New]: 'заявку прийнято',
  [PartRequestStatus.InReview]: 'заявка в роботі',
  [PartRequestStatus.PartFound]: 'сумісну запчастину знайдено',
  [PartRequestStatus.Rejected]: 'підбір завершено без результату',
};

export interface PartRequestNotification {
  event: string;
  vinCode: string;
  roomId: string;
  status: PartRequestStatus;
  statusLabel: string;
  requestedPart: string;
  part: EmailPartSummary | null;
  managerNote: string | null;
  updatedAt: string;
}

export interface PublishResultResponse {
  success: true;
  message: string;
  request: PartRequestEntity;
  notification: {
    roomId: string;
    event: string;
    receivers: number;
    payload: PartRequestNotification;
  };
  email: {
    to: string;
    subject: string;
    messageId: string;
    sentAt: string;
  };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly startedAt = new Date();
  private counters: Record<PartRequestStatus, number> & { total: number } = {
    total: 0,
    NEW: 0,
    IN_REVIEW: 0,
    PART_FOUND: 0,
    REJECTED: 0,
  };

  constructor(
    @InjectRepository(PartRequestEntity)
    private readonly requestsRepo: Repository<PartRequestEntity>,
    private readonly autoPartsService: AutoPartsService,
    private readonly eventsGateway: EventsGateway,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCounters();
  }

  async create(dto: CreatePartRequestDto): Promise<PartRequestEntity> {
    const vinCode = normalizeVin(dto.vinCode);
    const existing = await this.requestsRepo.findOneBy({ vinCode });
    if (existing) {
      throw new ConflictException(
        `Заявка для VIN ${vinCode} уже існує (статус ${existing.status})`,
      );
    }

    const request = this.requestsRepo.create({
      vinCode,
      customerEmail: dto.customerEmail.trim().toLowerCase(),
      requestedPart: dto.requestedPart.trim(),
      description: dto.description?.trim() || null,
      status: PartRequestStatus.New,
    });
    const saved = await this.requestsRepo.save(request);

    await this.refreshCounters();
    this.logger.log(
      `Створено заявку ${saved.id} за VIN ${saved.vinCode}, кімната ${partRequestRoom(vinCode)}`,
    );

    this.eventsGateway.emitToRoom(
      partRequestRoom(vinCode),
      EVENT_BY_STATUS[PartRequestStatus.New],
      this.buildNotification(saved),
    );

    return saved;
  }

  async findAll(query: PartRequestQueryDto): Promise<PartRequestEntity[]> {
    const qb = this.requestsRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.foundPart', 'foundPart')
      .leftJoinAndSelect('foundPart.carModel', 'carModel')
      .orderBy('request.updatedAt', 'DESC');

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }
    if (query.updatedAfter) {
      qb.andWhere('request.updatedAt >= :updatedAfter', {
        updatedAfter: query.updatedAfter,
      });
    }

    return qb.getMany();
  }

  async findByVin(vinCode: string): Promise<PartRequestEntity> {
    const vin = normalizeVin(vinCode);
    const request = await this.requestsRepo.findOne({
      where: { vinCode: vin },
      relations: { foundPart: { carModel: true } },
    });
    if (!request) {
      throw new NotFoundException(`Заявку за VIN ${vin} не знайдено`);
    }
    return request;
  }

  /**
   * Комплексний сценарій рівня 3: менеджер публікує результат підбору,
   * сервіс одночасно оновлює стан заявки, надсилає подію в кімнату
   * request_<VIN> та відправляє HTML-лист покупцю.
   */
  async publishResult(
    vinCode: string,
    dto: UpdatePartRequestStatusDto,
  ): Promise<PublishResultResponse> {
    const request = await this.findByVin(vinCode);

    let foundPart = request.foundPart;
    if (dto.foundPartId) {
      foundPart = await this.autoPartsService.findOne(dto.foundPartId);
    }

    if (dto.status === PartRequestStatus.PartFound && !foundPart) {
      throw new BadRequestException(
        'Для статусу PART_FOUND потрібно передати foundPartId сумісної запчастини',
      );
    }

    request.status = dto.status;
    request.foundPart = foundPart ?? null;
    request.managerNote = dto.managerNote?.trim() || request.managerNote;
    request.customerEmail =
      dto.customerEmail?.trim().toLowerCase() || request.customerEmail;
    request.notifiedAt = new Date();

    const saved = await this.requestsRepo.save(request);
    await this.refreshCounters();

    const roomId = partRequestRoom(saved.vinCode);
    const event = EVENT_BY_STATUS[dto.status];
    const payload = this.buildNotification(saved);
    const receivers = this.eventsGateway.emitToRoom(roomId, event, payload);

    const emailPayload = {
      vinCode: saved.vinCode,
      requestedPart: saved.requestedPart,
      customerEmail: saved.customerEmail,
      status: saved.status,
      managerNote: saved.managerNote,
      foundPart: payload.part,
      updatedAt: saved.updatedAt,
      portalUrl: `http://localhost:${process.env.PORT ?? 3000}/client.html?vin=${saved.vinCode}`,
    };
    const subject = partFoundSubject(emailPayload);
    const mail = await this.mailService.sendNotificationEmail(
      saved.customerEmail,
      subject,
      buildPartFoundEmail(emailPayload),
    );

    this.logger.log(
      `Заявку ${saved.vinCode} переведено у статус ${saved.status}. Подія ${event} у ${roomId}, лист на ${mail.to}`,
    );

    return {
      success: true,
      message:
        'Стан заявки оновлено, сповіщення надіслано в кімнату та лист на пошту',
      request: saved,
      notification: { roomId, event, receivers, payload },
      email: {
        to: mail.to,
        subject: mail.subject,
        messageId: mail.messageId,
        sentAt: mail.sentAt,
      },
    };
  }

  /**
   * Знімок стану для SSE-потоку. Дані беруться з памʼяті та лічильників,
   * тому кожен тік стріму не створює зайвих запитів до бази.
   */
  getStatus(): Record<string, unknown> {
    const rooms = this.eventsGateway.roomList;
    const activeConnections = this.eventsGateway.activeConnections;

    return {
      serverStatus: 'ONLINE',
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.round(
        (Date.now() - this.startedAt.getTime()) / 1000,
      ),
      activeConnections,
      rooms,
      partRequests: {
        total: this.counters.total,
        new: this.counters.NEW,
        inReview: this.counters.IN_REVIEW,
        partFound: this.counters.PART_FOUND,
        rejected: this.counters.REJECTED,
      },
      emailsSent: this.mailService.getSentCount(),
      lastEmailAt: this.mailService.getLastSentAt(),
    };
  }

  getCounters(): Record<PartRequestStatus, number> & { total: number } {
    return { ...this.counters };
  }

  private buildNotification(
    request: PartRequestEntity,
  ): PartRequestNotification {
    const part = request.foundPart
      ? {
          title: request.foundPart.title,
          oemCode: request.foundPart.oemCode,
          price: request.foundPart.price,
          condition: request.foundPart.condition,
          brand: request.foundPart.carModel?.brand ?? null,
          model: request.foundPart.carModel?.name ?? null,
        }
      : null;

    return {
      event: EVENT_BY_STATUS[request.status],
      vinCode: request.vinCode,
      roomId: partRequestRoom(request.vinCode),
      status: request.status,
      statusLabel: STATUS_LABELS[request.status],
      requestedPart: request.requestedPart,
      part,
      managerNote: request.managerNote,
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  /**
   * Лічильники для SSE перераховуються після кожної зміни стану,
   * щоб потік показував актуальні цифри без запитів на кожен тік.
   */
  private async refreshCounters(): Promise<void> {
    try {
      const rows = await this.requestsRepo
        .createQueryBuilder('request')
        .select('request.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('request.status')
        .getRawMany<{ status: PartRequestStatus; count: string }>();

      const counters = {
        total: 0,
        NEW: 0,
        IN_REVIEW: 0,
        PART_FOUND: 0,
        REJECTED: 0,
      };
      for (const row of rows) {
        const value = Number(row.count);
        counters[row.status] = value;
        counters.total += value;
      }
      this.counters = counters;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Не вдалося оновити лічильники заявок: ${reason}`);
    }
  }
}
