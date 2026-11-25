import {
  buildPartFoundEmail,
  partFoundSubject,
  type PartFoundEmailPayload,
} from './part-found.template.js';
import { PartRequestStatus } from '../entities/part-request.entity.js';

const payload: PartFoundEmailPayload = {
  vinCode: 'WVWZZZ1JZXW000001',
  requestedPart: 'Стартер',
  customerEmail: 'client@example.com',
  status: PartRequestStatus.PartFound,
  managerNote: 'Сумісність підтверджена каталогом виробника',
  foundPart: {
    title: 'Стартер Bosch 0001108231',
    oemCode: '0001108231',
    price: 4300,
    condition: 'REFURBISHED',
    brand: 'BMW',
    model: '3 Series G20',
  },
  updatedAt: new Date('2026-11-18T12:00:00.000Z'),
  portalUrl: 'http://localhost:3000/client.html?vin=WVWZZZ1JZXW000001',
};

describe('part-found.template', () => {
  it('формує тему листа з VIN і назвою запчастини', () => {
    expect(partFoundSubject(payload)).toBe(
      'Підбір за VIN WVWZZZ1JZXW000001: знайдено Стартер Bosch 0001108231',
    );
  });

  it('вставляє в лист параметри підбору та кнопку переходу', () => {
    const html = buildPartFoundEmail(payload);

    expect(html).toContain('WVWZZZ1JZXW000001');
    expect(html).toContain('Стартер Bosch 0001108231');
    expect(html).toContain('0001108231');
    expect(html).toContain('BMW 3 Series G20');
    expect(html).toContain('Відновлена');
    expect(html).toContain('Сумісність підтверджена каталогом виробника');
    expect(html).toContain('http://localhost:3000/client.html?vin=WVWZZZ1JZXW000001');
    expect(html).toMatch(/4[\s\u00A0\u202F]300/);
    expect(html).toContain('@media only screen and (max-width: 620px)');
  });

  it('екранує HTML у даних, які вводить користувач', () => {
    const html = buildPartFoundEmail({
      ...payload,
      requestedPart: '<script>alert("xss")</script>',
      managerNote: 'Коментар <b>без</b> розмітки',
    });

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Коментар &lt;b&gt;без&lt;/b&gt; розмітки');
  });

  it('показує статус без запчастини, якщо підбір не дав результату', () => {
    const html = buildPartFoundEmail({
      ...payload,
      status: PartRequestStatus.Rejected,
      foundPart: null,
      managerNote: null,
    });

    expect(html).toContain('Підбір завершено без результату');
    expect(html).not.toContain('Артикул (OEM)');
  });
});
