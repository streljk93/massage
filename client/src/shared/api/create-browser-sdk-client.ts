import { createClient, createConfig } from "./generated/sdk/client";
import type { ClientOptions } from "./generated/sdk/types.gen";

export function getBrowserApiV1BaseUrl(): string {
  const pub = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (pub) {
    return `${pub}/v1`;
  }
  return "/v1";
}

export function createBrowserSdkClient(accessToken: string) {
  return createClient(
    createConfig<ClientOptions>({
      baseUrl: getBrowserApiV1BaseUrl() as ClientOptions["baseUrl"],
      auth: accessToken,
    }),
  );
}
