/**
 * REST API: сгенерированный typed SDK (`@hey-api/openapi-ts`) из `back/openapi/openapi.json`.
 *
 * Обновление из корня: `npm run openapi:sync` (`openapi:export` + `api:sdk`).
 *
 * На сервере (RSC, route handlers) для запросов к Nest задавайте свой клиент через
 * {@link createServerSdkClient} и передавайте `client` в вызовы SDK (экспорт `client` из
 * сгенерированного кода по умолчанию с `baseUrl: '/v1'` — только для относительных URL).
 */
export * from "./generated/sdk";

export {
  createServerSdkClient,
  serverSdkFetchNoStore,
} from "./create-server-sdk-client";

/** Совпадает с `setGlobalPrefix("v1")` на бэкенде. */
export const API_V1_PREFIX = "/v1" as const;
