import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ApiLocale } from './api-locale';
import { requestLocaleQueryFieldSchema } from './request-locale-query.schema';

function readRawLocale(req: Request): unknown {
  const q = req.query?.locale;
  if (Array.isArray(q)) {
    return q[0];
  }
  return q;
}

/**
 * Достаёт `?locale=` из HTTP-запроса, валидирует по поддерживаемым локалям.
 * Пустое / отсутствующее значение → `en`. Невалидная строка → 400.
 */
export const RequestLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiLocale => {
    const raw = readRawLocale(ctx.switchToHttp().getRequest<Request>());
    if (raw === undefined || raw === '') {
      return 'en';
    }
    if (typeof raw !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_LOCALE',
        message: 'Query parameter locale must be a string',
      });
    }
    const normalized = raw.trim().toLowerCase();
    const parsed = requestLocaleQueryFieldSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_LOCALE',
        message: `Unsupported locale: ${raw}`,
      });
    }
    return parsed.data;
  },
);

/**
 * `?locale=` для ручек, где пустой query означает «не задано» (например fallback на `User.locale`).
 * Невалидная строка — 400.
 */
export const OptionalRequestLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiLocale | undefined => {
    const raw = readRawLocale(ctx.switchToHttp().getRequest<Request>());
    if (raw === undefined || raw === '') {
      return undefined;
    }
    if (typeof raw !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_LOCALE',
        message: 'Query parameter locale must be a string',
      });
    }
    const normalized = raw.trim().toLowerCase();
    const parsed = requestLocaleQueryFieldSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_LOCALE',
        message: `Unsupported locale: ${raw}`,
      });
    }
    return parsed.data;
  },
);
