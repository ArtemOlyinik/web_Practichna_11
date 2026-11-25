import type { PartRequestStatus } from '../entities/part-request.entity.js';

export interface EmailPartSummary {
  title: string;
  oemCode: string;
  price: number;
  condition: string;
  brand: string | null;
  model: string | null;
}

export interface PartFoundEmailPayload {
  vinCode: string;
  requestedPart: string;
  customerEmail: string;
  status: PartRequestStatus;
  managerNote: string | null;
  foundPart: EmailPartSummary | null;
  updatedAt: Date;
  portalUrl: string;
}

const STATUS_LABELS: Record<PartRequestStatus, string> = {
  NEW: 'Заявку прийнято',
  IN_REVIEW: 'Заявка в роботі',
  PART_FOUND: 'Сумісну запчастину знайдено',
  REJECTED: 'Підбір завершено без результату',
};

const STATUS_COLORS: Record<PartRequestStatus, string> = {
  NEW: '#2563eb',
  IN_REVIEW: '#b45309',
  PART_FOUND: '#15803d',
  REJECTED: '#b91c1c',
};

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Нова',
  REFURBISHED: 'Відновлена',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} грн`;
}

function formatDate(date: Date): string {
  const day = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(date);
  const time = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(date);
  return `${day}, ${time}`;
}

function row(label: string, value: string, last = false): string {
  const border = last ? 'none' : '1px solid #e5e7eb';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:${border};font-size:14px;line-height:20px;color:#6b7280;width:44%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:12px 0;border-bottom:${border};font-size:14px;line-height:20px;color:#111827;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`;
}

export function partFoundSubject(payload: PartFoundEmailPayload): string {
  if (payload.foundPart) {
    return `Підбір за VIN ${payload.vinCode}: знайдено ${payload.foundPart.title}`;
  }
  return `Підбір за VIN ${payload.vinCode}: ${STATUS_LABELS[payload.status].toLowerCase()}`;
}

/**
 * Адаптивний HTML-лист для клієнта: шапка з логотипом, статус,
 * таблиця параметрів підбору, коментар менеджера та кнопка переходу.
 * Верстка таблична з inline-стилями, бо поштові клієнти не завжди
 * підтримують зовнішній CSS.
 */
export function buildPartFoundEmail(payload: PartFoundEmailPayload): string {
  const statusLabel = STATUS_LABELS[payload.status];
  const statusColor = STATUS_COLORS[payload.status];
  const part = payload.foundPart;

  const partRows = part
    ? [
        row('Запчастина', escapeHtml(part.title)),
        row('Артикул (OEM)', escapeHtml(part.oemCode)),
        row(
          'Автомобіль',
          escapeHtml(
            [part.brand, part.model].filter(Boolean).join(' ') || 'Не вказано',
          ),
        ),
        row('Стан', CONDITION_LABELS[part.condition] ?? escapeHtml(part.condition)),
        row('Ціна', formatPrice(part.price)),
      ].join('')
    : '';

  const noteBlock = payload.managerNote
    ? `
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f0f9ff;border-left:4px solid #0284c7;border-radius:6px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px 0;font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:#0369a1;font-weight:700;">Коментар менеджера</p>
                  <p style="margin:0;font-size:14px;line-height:22px;color:#0c4a6e;">${escapeHtml(payload.managerNote)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(partFoundSubject(payload))}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell { width: 100% !important; }
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .email-title { font-size: 22px !important; line-height: 28px !important; }
      .email-table td { display: block !important; width: 100% !important; padding: 4px 0 !important; border-bottom: none !important; }
      .email-table tr { display: block !important; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px; }
      .email-cta { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Результат підбору запчастини для вашого автомобіля за VIN ${escapeHtml(payload.vinCode)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.12);">
          <tr>
            <td style="padding:28px 32px;background:#0f172a;background-image:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;border-radius:10px;background:#f59e0b;color:#0f172a;font-size:19px;font-weight:800;">AP</span>
                    <span style="display:inline-block;margin-left:12px;font-size:19px;font-weight:700;letter-spacing:0.04em;color:#ffffff;vertical-align:middle;">AUTOPARTS UA</span>
                  </td>
                  <td align="right" style="vertical-align:middle;font-size:12px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:#bfdbfe;">Підбір за VIN</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:32px 32px 12px 32px;">
              <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:700;">Заявка ${escapeHtml(payload.vinCode)}</p>
              <h1 class="email-title" style="margin:0 0 14px 0;font-size:26px;line-height:34px;color:#0f172a;font-weight:800;">${escapeHtml(statusLabel)}</h1>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#475569;">Вітаємо! Менеджер опрацював вашу заявку на підбір запчастини. Нижче - підсумок підбору та контактні дані для підтвердження замовлення.</p>
              <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:${statusColor};color:#ffffff;font-size:12px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;">${escapeHtml(statusLabel)}</span>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:24px 32px 8px 32px;">
              <table role="presentation" class="email-table" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${row('VIN-код', `<span style="font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:0.06em;">${escapeHtml(payload.vinCode)}</span>`)}
                ${row('Що шукали', escapeHtml(payload.requestedPart))}
                ${partRows}
                ${row('Оновлено', formatDate(payload.updatedAt), true)}
              </table>
            </td>
          </tr>
          ${noteBlock}
          <tr>
            <td class="email-pad" style="padding:20px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="border-radius:10px;background:#f59e0b;">
                    <a class="email-cta" href="${escapeHtml(payload.portalUrl)}" style="display:inline-block;padding:14px 26px;font-size:15px;line-height:20px;font-weight:700;color:#0f172a;text-decoration:none;">Відкрити заявку в кабінеті</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:24px 32px 32px 32px;">
              <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">Лист надіслано на адресу ${escapeHtml(payload.customerEmail)}. Якщо ви не створювали заявку, просто проігноруйте це повідомлення або напишіть на <a href="mailto:support@autoparts.local" style="color:#1d4ed8;text-decoration:none;">support@autoparts.local</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">AUTOPARTS UA - підбір і доставка автозапчастин. Цей лист сформовано автоматично, відповідати на нього не потрібно.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
