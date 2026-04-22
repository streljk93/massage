import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { SUPPORTED_API_LOCALES } from './api-locale';

const LOCALE_QUERY = {
  name: 'locale',
  required: false,
  enum: [...SUPPORTED_API_LOCALES],
  description:
    'Локаль для локализованных полей из таблиц *Locale. Если не задана, применяется правило ручки (например `User.locale` или en). Невалидное значение — 400.',
} as const;

/** Swagger-декоратор для общего query `locale` на ручках с i18n-таблицами. */
export function ApiLocaleQueryDocs() {
  return applyDecorators(ApiQuery(LOCALE_QUERY));
}
