import type { Server, Socket } from 'socket.io';
import {
  EventsGateway,
  partRequestRoom,
  ROOM_ID_PATTERN,
} from './events.gateway.js';

const VIN = 'WVWZZZ1JZXW000001';

interface ServerMock {
  server: Server;
  emit: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
  roomEmit: ReturnType<typeof vi.fn>;
  rooms: Map<string, Set<string>>;
}

function buildServer(clientsCount = 1): ServerMock {
  const rooms = new Map<string, Set<string>>();
  const roomEmit = vi.fn();
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit: roomEmit });
  const server = {
    engine: { clientsCount },
    sockets: { adapter: { rooms } },
    emit,
    to,
  } as unknown as Server;

  return { server, emit, to, roomEmit, rooms };
}

function buildClient(id = 'socket-1') {
  return {
    id,
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
  };
}

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let serverMock: ServerMock;

  beforeEach(() => {
    gateway = new EventsGateway();
    serverMock = buildServer(2);
    gateway.server = serverMock.server;
  });

  it('формує назву кімнати з VIN у верхньому регістрі', () => {
    expect(partRequestRoom(' wvwzzz1jzxw000001 ')).toBe(
      'request_WVWZZZ1JZXW000001',
    );
    expect(ROOM_ID_PATTERN.test('request_WVWZZZ1JZXW000001')).toBe(true);
    expect(ROOM_ID_PATTERN.test('order_101')).toBe(false);
  });

  it('під час підключення надсилає клієнту socket.id і кількість зʼєднань', () => {
    const client = buildClient('socket-42');

    gateway.handleConnection(client as unknown as Socket);

    expect(client.emit).toHaveBeenCalledWith(
      'connected',
      expect.objectContaining({
        socketId: 'socket-42',
        activeConnections: 2,
      }),
    );
  });

  it('ping повертає pong із таймстемпом і ack-відповіддю', () => {
    const client = buildClient('socket-7');

    const ack = gateway.handlePing(
      { sentAt: '2026-11-18T10:00:00.000Z' },
      client as unknown as Socket,
    );

    const payload = client.emit.mock.calls[0]?.[1];
    expect(client.emit).toHaveBeenCalledWith('pong', expect.any(Object));
    expect(payload.socketId).toBe('socket-7');
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(ack).toEqual(payload);
  });

  it('транслює globalAlert усім сокетам і повертає кількість отримувачів', () => {
    const client = buildClient('socket-9');

    const result = gateway.handleBroadcast(
      { message: '  Нова партія запчастин  ' },
      client as unknown as Socket,
    );

    expect(serverMock.emit).toHaveBeenCalledWith('globalAlert', {
      sender: 'socket-9',
      message: 'Нова партія запчастин',
      sentAt: expect.any(String),
    });
    expect(result).toEqual({ status: 'broadcasted', receivers: 2 });
  });

  it('не транслює порожнє повідомлення', () => {
    const client = buildClient();

    const result = gateway.handleBroadcast(
      { message: '   ' },
      client as unknown as Socket,
    );

    expect(serverMock.emit).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('roomError', expect.any(Object));
    expect(result.status).toBe('error');
  });

  it('приєднує клієнта до кімнати за VIN і рахує учасників', () => {
    const client = buildClient('socket-1');
    serverMock.rooms.set(partRequestRoom(VIN), new Set(['socket-1']));

    const result = gateway.handleJoinRoom(
      { vinCode: VIN.toLowerCase() },
      client as unknown as Socket,
    );

    expect(client.join).toHaveBeenCalledWith('request_WVWZZZ1JZXW000001');
    expect(client.emit).toHaveBeenCalledWith(
      'joined',
      expect.objectContaining({
        roomId: 'request_WVWZZZ1JZXW000001',
        members: 1,
      }),
    );
    expect(result.status).toBe('success');
  });

  it('відхиляє кімнату з неправильним VIN', () => {
    const client = buildClient();

    const result = gateway.handleJoinRoom(
      { vinCode: 'INVALID-VIN' },
      client as unknown as Socket,
    );

    expect(client.join).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('виводить клієнта з кімнати', () => {
    const client = buildClient('socket-3');

    const result = gateway.handleLeaveRoom(
      { vinCode: VIN },
      client as unknown as Socket,
    );

    expect(client.leave).toHaveBeenCalledWith('request_WVWZZZ1JZXW000001');
    expect(result.members).toBe(0);
  });

  it('надсилає подію лише вказаній кімнаті', () => {
    const roomId = partRequestRoom(VIN);
    serverMock.rooms.set(roomId, new Set(['socket-1', 'socket-2']));

    const receivers = gateway.emitToRoom(roomId, 'partFound', { vinCode: VIN });

    expect(receivers).toBe(2);
    expect(serverMock.to).toHaveBeenCalledWith(roomId);
    expect(serverMock.roomEmit).toHaveBeenCalledWith('partFound', {
      vinCode: VIN,
    });
  });

  it('показує лише кімнати заявок у списку для SSE', () => {
    serverMock.rooms.set(partRequestRoom(VIN), new Set(['socket-1']));
    serverMock.rooms.set('room-of-socket-1', new Set(['socket-1']));

    expect(gateway.roomList).toEqual([
      { roomId: 'request_WVWZZZ1JZXW000001', members: 1 },
    ]);
  });
});
