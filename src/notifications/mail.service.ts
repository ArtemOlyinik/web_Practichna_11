import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SentMail {
  to: string;
  subject: string;
  messageId: string;
  accepted: string[];
  sentAt: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private sentCount = 0;
  private lastSentAt: string | null = null;

  constructor() {
    const host = process.env.SMTP_HOST ?? 'localhost';
    const port = Number(process.env.SMTP_PORT ?? 1025);
    this.from =
      process.env.MAIL_FROM ?? '"AutoParts UA" <no-reply@autoparts.local>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    this.logger.log(
      `Транспорт nodemailer налаштовано на SMTP ${host}:${port}, відправник ${this.from}`,
    );
  }

  /**
   * Відправляє HTML-лист через SMTP. У навчальному середовищі це Mailpit,
   * тому лист не виходить у зовнішню мережу, а перехоплюється пасткою.
   */
  async sendNotificationEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<SentMail> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html: htmlContent,
        text: this.toPlainText(htmlContent),
      });

      const sentAt = new Date().toISOString();
      this.sentCount += 1;
      this.lastSentAt = sentAt;

      this.logger.log(
        `Лист успішно надіслано на адресу ${to} (Message ID: ${info.messageId})`,
      );

      return {
        to,
        subject,
        messageId: info.messageId,
        accepted: (info.accepted ?? []).map(String),
        sentAt,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Не вдалося надіслати лист на ${to}: ${reason}`);
      throw new ServiceUnavailableException(
        `SMTP-сервер недоступний: ${reason}. Перевірте, чи запущено Mailpit (docker compose up -d)`,
      );
    }
  }

  getSentCount(): number {
    return this.sentCount;
  }

  getLastSentAt(): string | null {
    return this.lastSentAt;
  }

  /**
   * Текстова версія листа для клієнтів без HTML та для антиспам-фільтрів.
   */
  private toPlainText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
