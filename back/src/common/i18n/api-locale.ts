/** Локали API (синхрон с routing клиента). Новый язык — расширить массив, сиды и переводы. */
export const SUPPORTED_API_LOCALES = ['en', 'vi', 'ru'] as const;

export type ApiLocale = (typeof SUPPORTED_API_LOCALES)[number];

/** @deprecated Используйте `SUPPORTED_API_LOCALES`. */
export const SUPPORTED_CATALOG_LOCALES = SUPPORTED_API_LOCALES;

/** @deprecated Используйте `ApiLocale`. */
export type SupportedCatalogLocale = ApiLocale;

/**
 * Нормализует уже валидное/опциональное значение (после Zod или пустой query).
 * Неизвестные строки дают `en` — для строгой валидации используйте декоратор `RequestLocale`.
 */
export function parseApiLocale(value: unknown): ApiLocale {
  if (typeof value !== 'string') {
    return 'en';
  }
  const v = value.trim().toLowerCase();
  return (SUPPORTED_API_LOCALES as readonly string[]).includes(v)
    ? (v as ApiLocale)
    : 'en';
}

/** @deprecated Используйте `parseApiLocale`. */
export const parseCatalogLocale = parseApiLocale;
