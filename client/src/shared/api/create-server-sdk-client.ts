import { createClient, createConfig } from "./generated/sdk/client";
import type { ClientOptions } from "./generated/sdk/types.gen";

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
 */
export function createServerSdkClient() {
  const base = process.env.AUTH_BACKEND_URL?.replace(/\/+$/, "");
  if (!base) {
    return null;
  }

  const baseUrl = `${base}/v1`;

  return createClient(
    createConfig<ClientOptions>({
      baseUrl: baseUrl as ClientOptions["baseUrl"],
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: 120 },
        }),
    }),
  );
}
