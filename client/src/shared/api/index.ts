/**
 * Типы REST API бэкенда (генерация из `back/openapi/openapi.json`).
 *
 * Обновление из корня монорепо: `npm run openapi:sync` (или по шагам
 * `npm run openapi:export` / `npm run openapi:types` — см. `scripts/openapi.mjs`).
 */
export type { components, operations, paths } from "./generated/openapi";

/** Совпадает с `setGlobalPrefix("v1")` на бэкенде и `servers[0].url` в OpenAPI. */
export const API_V1_PREFIX = "/v1" as const;

/** Полный path вида `/v1/auth/login` для сопоставления с `paths` в спеке. */
export function apiV1Path(path: keyof import("./generated/openapi").paths): string {
  return `${API_V1_PREFIX}${path}`;
}
