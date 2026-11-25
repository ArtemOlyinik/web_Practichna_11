import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service.js';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({
      messageId: '<test-mailpit@autoparts.local>',
      accepted: ['client@example.com'],
    });
    service = new MailService();
  });

  it('відправляє HTML-лист з текстовою версією та повертає Message ID', async () => {
    const result = await service.sendNotificationEmail(
      'client@example.com',
      'Знайдено запчастину',
      '<h1>Вітаємо</h1><p>Сумісний стартер уже в наявності</p>',
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Знайдено запчастину',
        html: expect.stringContaining('Сумісний стартер'),
        text: expect.stringContaining('Вітаємо'),
      }),
    );

    const sentMail = sendMail.mock.calls[0]?.[0];
    expect(sentMail.text).not.toContain('<h1>');
    expect(result.messageId).toBe('<test-mailpit@autoparts.local>');
    expect(result.accepted).toEqual(['client@example.com']);
    expect(service.getSentCount()).toBe(1);
    expect(service.getLastSentAt()).toEqual(expect.any(String));
  });

  it('перетворює помилку SMTP на ServiceUnavailableException', async () => {
    // Очікувана помилка перевіряється через rejects, тому лог не друкуємо.
    const logger = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    sendMail.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1025'));

    await expect(
      service.sendNotificationEmail('client@example.com', 'Тест', '<p>Текст</p>'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(service.getSentCount()).toBe(0);
    logger.mockRestore();
  });
});
