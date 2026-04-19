import type { AppLocale } from "./routing";

/**
 * Формат colocated-файлов `*.i18n.json` (все локали в одном файле).
 * Корень `messages` обязан содержать ключи `en`, `vi`, `ru`.
 */
export type ColocatedI18nBundle = {
  messages: Record<AppLocale, Record<string, unknown>>;
};
