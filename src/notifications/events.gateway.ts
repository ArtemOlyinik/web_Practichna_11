import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Public } from '../auth/decorators/public.decorator.js';
import { VIN_PATTERN } from './dto/create-part-request.dto.js';

/**
 * Назва кімнати для заявки на підбір запчастини (варіант 7 - автозапчастини).
 * Один VIN - одна кімната, тому сповіщення отримує лише власник цього авто.
 */
export const PART_REQUEST_ROOM_PREFIX = 'request_';

export function normalizeVin(vinCode: string): string {
  return vinCode.trim().toUpperCase();
}

export function partRequestRoom(vinCode: string): string {
  return `${PART_REQUEST_ROOM_PREFIX}${normalizeVin(vinCode)}`;
}

export const ROOM_ID_PATTERN = new RegExp(
  `^${PART_REQUEST_ROOM_PREFIX}[A-HJ-NPR-Z0-9]{17}$`,
);

interface BroadcastPayload {
  sender: string;
  message: string;
  sentAt: string;
}

interface RoomPayload {
  status: 'success';
  roomId: string;
  socketId: string;
  members: number;
}

interface RoomErrorPayload {
  status: 'error';
  message: string;
}

interface RoomMembersPayload {
  roomId: string;
  members: number;
  sockets: string[];
}

interface ConnectedPayload {
  socketId: string;
  connectedAt: string;
  activeConnections: number;
}

/**
 * Шлюз відкритий для підключень: глобальний JwtAuthGuard із практичної 9
 * перевіряє лише HTTP-контекст, а для сокетів немає заголовка Authorization.
 * Керування даними (публікація результату підбору) залишається за REST із JWT.
 */
@Public()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  /**
   * Клієнтська бібліотека socket.io віддається самим сервером
   * за адресою /socket.io/socket.io.js, тому сторінці не потрібен CDN.
   */
  serveClient: true,
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    this.logger.log(
      'WebSocket Gateway ініціалізовано: протокол Socket.IO, CORS дозволено для всіх джерел',
    );
  }

  handleConnection(client: Socket): void {
    const payload: ConnectedPayload = {
      socketId: client.id,
      connectedAt: new Date().toISOString(),
      activeConnections: this.activeConnections,
    };

    this.logger.log(
      `Клієнт підключився: ${client.id} (активних з'єднань: ${payload.activeConnections})`,
    );
    client.emit('connected', payload);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Клієнт відключився: ${client.id}`);
  }

  /**
   * Перевірка живого каналу: клієнт надсилає ping, сервер відповідає pong
   * із власним таймстемпом. Окремо повертаємо ack-відповідь.
   */
  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown, @ConnectedSocket() client: Socket) {
    const payload = {
      socketId: client.id,
      timestamp: new Date().toISOString(),
      echo: data ?? null,
    };

    client.emit('pong', payload);
    return payload;
  }

  /**
   * Широкомовлення: повідомлення бачать усі активні сокети, включно з автором.
   */
  @SubscribeMessage('broadcastNotification')
  handleBroadcast(
    @MessageBody() data: { message?: string } | string,
    @ConnectedSocket() client: Socket,
  ) {
    const message =
      typeof data === 'string' ? data : (data?.message ?? '').trim();

    if (!message) {
      client.emit('roomError', {
        status: 'error',
        message: 'Порожнє повідомлення не можна транслювати',
      } satisfies RoomErrorPayload);
      return { status: 'error', message: 'Порожнє повідомлення' };
    }

    const payload: BroadcastPayload = {
      sender: client.id,
      message,
      sentAt: new Date().toISOString(),
    };

    this.server.emit('globalAlert', payload);
    this.logger.log(
      `Широкомовлення від ${client.id}: "${message}" (отримувачів: ${this.activeConnections})`,
    );

    return { status: 'broadcasted', receivers: this.activeConnections };
  }

  /**
   * Підписка на кімнату. Приймає або готовий roomId (request_<VIN>),
   * або vinCode - тоді назву кімнати формує сервер.
   */
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() body: { roomId?: string; vinCode?: string } | string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = this.resolveRoomId(body);
    if (!roomId) {
      const error: RoomErrorPayload = {
        status: 'error',
        message:
          'Кімната має назву request_<VIN>, де VIN - 17 символів без I, O, Q',
      };
      client.emit('roomError', error);
      return error;
    }

    void client.join(roomId);
    const payload: RoomPayload = {
      status: 'success',
      roomId,
      socketId: client.id,
      members: this.roomMembers(roomId).length,
    };

    this.logger.log(
      `Клієнт ${client.id} приєднався до кімнати: ${roomId} (учасників: ${payload.members})`,
    );
    client.emit('joined', payload);
    return payload;
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() body: { roomId?: string; vinCode?: string } | string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = this.resolveRoomId(body);
    if (!roomId) {
      const error: RoomErrorPayload = {
        status: 'error',
        message: 'Некоректна назва кімнати',
      };
      client.emit('roomError', error);
      return error;
    }

    void client.leave(roomId);
    const payload: RoomPayload = {
      status: 'success',
      roomId,
      socketId: client.id,
      members: this.roomMembers(roomId).length,
    };

    this.logger.log(
      `Клієнт ${client.id} вийшов з кімнати: ${roomId} (залишилось: ${payload.members})`,
    );
    client.emit('left', payload);
    return payload;
  }

  @SubscribeMessage('roomMembers')
  handleRoomMembers(@MessageBody() body: { roomId?: string; vinCode?: string }) {
    const roomId = this.resolveRoomId(body);
    if (!roomId) {
      return { roomId: null, members: 0, sockets: [] };
    }
    const sockets = this.roomMembers(roomId);
    return {
      roomId,
      members: sockets.length,
      sockets,
    } satisfies RoomMembersPayload;
  }

  /**
   * Адресне сповіщення: подію отримують лише сокети конкретної кімнати.
   * Повертає кількість сокетів, яким фактично пішло повідомлення.
   */
  emitToRoom<T>(roomId: string, event: string, data: T): number {
    const receivers = this.roomMembers(roomId).length;
    this.server.to(roomId).emit(event, data);
    this.logger.log(
      `Сповіщення надіслано в кімнату ${roomId}: { event: '${event}', отримувачів: ${receivers} }`,
    );
    return receivers;
  }

  get activeConnections(): number {
    return this.server?.engine?.clientsCount ?? 0;
  }

  get roomList(): { roomId: string; members: number }[] {
    const rooms = this.server?.sockets?.adapter?.rooms;
    if (!rooms) {
      return [];
    }

    return [...rooms.entries()]
      .filter(([roomId]) => ROOM_ID_PATTERN.test(roomId))
      .map(([roomId, sockets]) => ({ roomId, members: sockets.size }))
      .sort((left, right) => left.roomId.localeCompare(right.roomId));
  }

  private resolveRoomId(
    body: { roomId?: string; vinCode?: string } | string,
  ): string | null {
    if (typeof body === 'string') {
      const raw = body.trim();
      return ROOM_ID_PATTERN.test(raw) ? raw : null;
    }

    const vinCode = body?.vinCode?.trim();
    if (vinCode && VIN_PATTERN.test(vinCode)) {
      return partRequestRoom(vinCode);
    }

    const roomId = body?.roomId?.trim();
    return roomId && ROOM_ID_PATTERN.test(roomId) ? roomId : null;
  }

  private roomMembers(roomId: string): string[] {
    const sockets = this.server?.sockets?.adapter?.rooms?.get(roomId);
    return sockets ? [...sockets] : [];
  }
}
