import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Для WebSocket-подій немає HTTP-відповіді, тому таймінг не застосовуємо.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let logged = false;

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;

        /**
         * SSE-потік віддає багато значень в одній відповіді, тому заголовок
         * ставимо лише до першого запису, а лог пишемо один раз на запит.
         */
        if (!response.headersSent) {
          response.setHeader('X-Response-Time', `${elapsed}ms`);
        }

        if (!logged) {
          logged = true;
          this.logger.log(
            `[TIMING] ${request.method} ${request.originalUrl} ${elapsed}ms`,
          );
        }
      }),
    );
  }
}
