import { createClient, createConfig } from "./generated/sdk/client";
import type { ClientOptions } from "./generated/sdk/types.gen";

type CreateServerSdkClientOptions = {
  /** Bearer access (сессия NextAuth) — для ручек, где от ответа зависит владелец (модерация и т.д.). */
  accessToken?: string | null;
};

/**
 * `fetch` без кэша Data Cache Next.js — для баннеров и другого контента, который
 * должен совпадать с API сразу после сида/админки (иначе до `revalidate` виден старый JSON).
 */
export function serverSdkFetchNoStore(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
}

/**
 * Typed SDK-клиент для серверных вызовов (RSC, route handlers) к Nest API.
 * `baseUrl` = `AUTH_BACKEND_URL` + `/v1`. Без переменной — `null`.
 * При `accessToken` запросы к опционально защищённым GET отдают данные «как для владельца» (напр. статус модерации).
 */
export function createServerSdkClient(options?: CreateServerSdkClientOptions) {
  const base = process.env.AUTH_BACKEND_URL?.replace(/\/+$/, "");
  if (!base) {
    return null;
  }

  const baseUrl = `${base}/v1`;
  const token = options?.accessToken?.trim();

  return createClient(
    createConfig<ClientOptions>({
      baseUrl: baseUrl as ClientOptions["baseUrl"],
      ...(token ? { auth: token } : {}),
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: 120 },
        }),
    }),
  );
}
