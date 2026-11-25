import { io } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const TARGET_VIN = 'WVWZZZ1JZXW000001';
const OTHER_VIN = 'JN1TANT31U0123456';
const MANAGER = { email: 'mechanic@autoparts.local', password: 'Mechanic12345' };

const stamp = () =>
  new Date().toLocaleTimeString('uk-UA', { hour12: false });
const log = (message) => console.log(`[${stamp()}] ${message}`);
const rule = (title) => {
  console.log('');
  console.log(`=== ${title} ===`);
};

function connectClient(name) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      timeout: 5000,
      reconnection: false,
    });
    socket.once('connect', () => {
      log(`${name}: підключено, socket.id = ${socket.id}`);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      reject(new Error(`${name}: помилка підключення - ${error.message}`));
    });
  });
}

function waitForEvent(socket, event, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);

    const handler = (payload) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function emitWithAck(socket, event, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Немає ack-відповіді на подію ${event} за ${timeoutMs} мс`));
    }, timeoutMs);

    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function ensureRequest(vinCode) {
  const existing = await api(`/notifications/part-requests/${vinCode}`);
  if (existing.status === 200) {
    log(
      `Заявка за VIN ${vinCode} уже є в базі, статус ${existing.body.status}. Використовуємо її.`,
    );
    return existing.body;
  }

  const created = await api('/notifications/part-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vinCode,
      customerEmail: 'client@example.com',
      requestedPart: 'Стартер',
      description: 'Потрібен сумісний стартер, автомобіль не заводиться з першої спроби',
    }),
  });

  if (created.status !== 201) {
    throw new Error(
      `Не вдалося створити заявку: ${created.status} ${JSON.stringify(created.body)}`,
    );
  }

  log(
    `Створено заявку ${created.body.id} за VIN ${created.body.vinCode}, статус ${created.body.status}`,
  );
  return created.body;
}

async function readSseTicks(count = 2) {
  const controller = new AbortController();
  const response = await fetch(`${BASE_URL}/notifications/events/stream`, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });

  if (response.status !== 200) {
    throw new Error(`SSE відповів статусом ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const ticks = [];
  let buffer = '';

  try {
    while (ticks.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const dataLine = block
          .split('\n')
          .find((line) => line.startsWith('data: '));
        if (dataLine) {
          ticks.push(JSON.parse(dataLine.slice(6)));
        }
      }
    }
  } finally {
    controller.abort();
  }

  return ticks;
}

async function readLatestMail() {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.messages?.[0] ?? null;
}

async function main() {
  console.log('Перевірка комунікації у реальному часі (варіант 7 - автозапчастини)');
  log(`Сервер: ${BASE_URL}`);

  rule('1. Два клієнти Socket.IO');
  const customer = await connectClient('Клієнт A (покупець)');
  const observer = await connectClient('Клієнт B (інший покупець)');

  rule('2. Подія ping -> pong із таймстемпом сервера');
  const pongPromise = waitForEvent(customer, 'pong');
  const ack = await emitWithAck(customer, 'ping', {
    sentAt: new Date().toISOString(),
  });
  const pong = await pongPromise;
  log(`ack від сервера: ${JSON.stringify(ack)}`);
  log(`pong: ${JSON.stringify(pong)}`);

  rule('3. Широкомовлення broadcastNotification -> globalAlert');
  const alertA = waitForEvent(customer, 'globalAlert');
  const alertB = waitForEvent(observer, 'globalAlert');
  const broadcastAck = await emitWithAck(
    customer,
    'broadcastNotification',
    { message: 'Нова партія гальмівних колодок Brembo вже на складі' },
  );
  const receivedA = await alertA;
  const receivedB = await alertB;
  log(`ack: ${JSON.stringify(broadcastAck)}`);
  log(`отримав клієнт A: ${JSON.stringify(receivedA)}`);
  log(`отримав клієнт B: ${JSON.stringify(receivedB)}`);

  rule('4. Кімнати за VIN: різні підписники - різні канали');
  const joinA = await emitWithAck(customer, 'joinRoom', {
    vinCode: TARGET_VIN,
  });
  const joinB = await emitWithAck(observer, 'joinRoom', { vinCode: OTHER_VIN });
  log(`клієнт A: ${JSON.stringify(joinA)}`);
  log(`клієнт B: ${JSON.stringify(joinB)}`);

  rule('5. Вхід менеджера та підготовка заявки');
  const login = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(MANAGER),
  });
  if (login.status !== 200) {
    throw new Error(`Вхід менеджера неуспішний: ${login.status}`);
  }
  const token = login.body.accessToken;
  log(
    `Менеджер ${login.body.user.email} (${login.body.user.role}) отримав токен ${token.slice(0, 24)}...`,
  );

  const request = await ensureRequest(TARGET_VIN);

  const catalog = await api('/auto-parts?page=1&limit=10');
  const part =
    catalog.body.data.find((item) => item.oemCode === '0001108231') ??
    catalog.body.data[0];
  if (!part) {
    throw new Error('Каталог запчастин порожній, спочатку виконайте сід');
  }
  log(`Обрана запчастина: ${part.title} (${part.oemCode}), ${part.price} грн`);

  rule('6. PATCH статусу: WebSocket у кімнату + HTML-лист');
  const targetEvent = waitForEvent(customer, 'partFound');
  const otherEvent = waitForEvent(observer, 'partFound', 3000);

  const patch = await api(
    `/notifications/part-requests/${request.vinCode}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: 'PART_FOUND',
        foundPartId: part.id,
        managerNote:
          'Перевірено за каталогом виробника: повна сумісність, гарантія 12 місяців',
      }),
    },
  );

  if (patch.status !== 200) {
    throw new Error(`PATCH неуспішний: ${patch.status} ${JSON.stringify(patch.body)}`);
  }

  log(`HTTP ${patch.status}: ${patch.body.message}`);
  log(
    `кімната ${patch.body.notification.roomId}, подія ${patch.body.notification.event}, отримувачів ${patch.body.notification.receivers}`,
  );
  log(
    `лист: "${patch.body.email.subject}" -> ${patch.body.email.to} (Message ID: ${patch.body.email.messageId})`,
  );

  const eventA = await targetEvent;
  const eventB = await otherEvent;
  log(`клієнт A у кімнаті ${joinA.roomId} отримав: ${JSON.stringify(eventA)}`);
  log(
    eventB
      ? `клієнт B несподівано отримав: ${JSON.stringify(eventB)}`
      : `клієнт B у кімнаті ${joinB.roomId} подію partFound не отримав - адресність працює`,
  );

  rule('7. Перевірка листа в Mailpit');
  const mail = await readLatestMail();
  if (mail) {
    log(`листів у пастці: останній "${mail.Subject}"`);
    const recipients = mail.To
      .map((item) => (item.Name ? `${item.Name} <${item.Address}>` : item.Address))
      .join(', ');
    log(`отримувач: ${recipients}, розмір ${mail.Size} байт`);
  } else {
    log('Mailpit недоступний або листів немає');
  }

  rule('8. Server-Sent Events: два тіки потоку');
  const ticks = await readSseTicks(2);
  for (const tick of ticks) {
    log(
      `тік ${tick.tick}: ${tick.serverStatus}, клієнтів ${tick.activeConnections}, кімнат ${tick.rooms.length}, ` +
        `заявок ${tick.partRequests.total}, листів ${tick.emailsSent}, час ${tick.serverTime}`,
    );
  }

  rule('9. Вихід з кімнати');
  const left = await emitWithAck(customer, 'leaveRoom', { vinCode: TARGET_VIN });
  log(`клієнт A: ${JSON.stringify(left)}`);

  customer.disconnect();
  observer.disconnect();
  log('Обидва клієнти відключено, сценарій завершено');
}

main().catch((error) => {
  console.error(`Помилка сценарію: ${error.message}`);
  process.exitCode = 1;
});
