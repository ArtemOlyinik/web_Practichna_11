import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { interval, map, startWith, type Observable } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import { CreatePartRequestDto } from './dto/create-part-request.dto.js';
import { PartRequestQueryDto } from './dto/part-request-query.dto.js';
import { UpdatePartRequestStatusDto } from './dto/update-part-request-status.dto.js';
import { EventsGateway, partRequestRoom } from './events.gateway.js';
import { NotificationsService } from './notifications.service.js';

const DEFAULT_SSE_INTERVAL_MS = 5000;

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Server-Sent Events: сервер кожні 5 секунд штовхає клієнту стан системи.
   * Потік побудований на RxJS interval() і map(), як вимагає завдання.
   */
  @Public()
  @Sse('events/stream')
  stream(): Observable<MessageEvent> {
    const intervalMs = Number(
      process.env.SSE_INTERVAL_MS ?? DEFAULT_SSE_INTERVAL_MS,
    );

    this.logger.log(
      `Клієнт підключився до SSE-потоку /notifications/events/stream (інтервал ${intervalMs} мс)`,
    );

    return interval(intervalMs).pipe(
      startWith(-1),
      map((tick) => ({
        id: `${Date.now()}`,
        retry: intervalMs,
        data: {
          tick: tick + 1,
          intervalMs,
          ...this.notificationsService.getStatus(),
        },
      })),
    );
  }

  @Public()
  @Get('status')
  status(): Record<string, unknown> {
    return {
      ...this.notificationsService.getStatus(),
      socketRooms: this.eventsGateway.roomList,
    };
  }

  /**
   * Клієнт створює заявку на підбір запчастини за VIN-кодом.
   * Публічний маршрут: покупець не має облікового запису.
   */
  @Public()
  @Post('part-requests')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePartRequestDto) {
    return this.notificationsService.create(dto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Get('part-requests')
  findAll(@Query() query: PartRequestQueryDto) {
    return this.notificationsService.findAll(query);
  }

  @Public()
  @Get('part-requests/:vinCode')
  findByVin(@Param('vinCode') vinCode: string) {
    return this.notificationsService.findByVin(vinCode);
  }

  /**
   * Робоче місце менеджера: публікація результату підбору.
   * Один виклик - три дії: оновлення заявки, подія в кімнату, HTML-лист.
   */
  @Roles(Role.Admin, Role.Mechanic)
  @Patch('part-requests/:vinCode/status')
  publishResult(
    @Param('vinCode') vinCode: string,
    @Body() dto: UpdatePartRequestStatusDto,
  ) {
    this.logger.log(
      `PATCH /notifications/part-requests/${vinCode}/status -> ${dto.status}, кімната ${partRequestRoom(vinCode)}`,
    );
    return this.notificationsService.publishResult(vinCode, dto);
  }
}
