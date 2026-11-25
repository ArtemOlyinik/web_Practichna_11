import { Injectable, type PipeTransform } from '@nestjs/common';

const MAX_DEPTH = 10;

@Injectable()
export class TrimPipe implements PipeTransform {
  /**
   * Обрізає пробіли у рядках DTO. Обробляє лише прості обʼєкти та масиви:
   * екземпляри класів (Date, Socket, Buffer) повертаються без змін, інакше
   * рекурсія по службових полях сокета зациклюється.
   */
  transform(value: unknown): unknown {
    return this.trimValue(value, 0);
  }

  private trimValue(value: unknown, depth: number): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (depth >= MAX_DEPTH) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.trimValue(item, depth + 1));
    }

    if (value !== null && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        return value;
      }

      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.trimValue(item, depth + 1);
      }
      return result;
    }

    return value;
  }
}
