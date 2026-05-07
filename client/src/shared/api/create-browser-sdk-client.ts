import type { AppLocale } from "@/app/i18n/routing";
import { formatApiErrorForToast } from "@/shared/lib/api/format-api-error-toast";
import { notify } from "@/shared/lib/notifications/notify";
import {
  createClient,
  createConfig,
  type ResolvedRequestOptions,
} from "./generated/sdk/client";
import type { ClientOptions } from "./generated/sdk/types.gen";

export function getBrowserApiV1BaseUrl(): string {
  const pub = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (pub) {
    return `${pub}/v1`;
  }
  return "/v1";
}

export type CreateBrowserSdkClientOptions = {
  locale?: AppLocale;
};

const READ_METHODS = new Set(["GET", "HEAD"]);

let lastUnauthorizedToastAt = 0;
const UNAUTHORIZED_TOAST_COOLDOWN_MS = 3500;

export function createBrowserSdkClient(
  accessToken: string,
  options?: CreateBrowserSdkClientOptions,
) {
  const locale = options?.locale ?? "en";

  const client = createClient(
    createConfig<ClientOptions>({
      baseUrl: getBrowserApiV1BaseUrl() as ClientOptions["baseUrl"],
      auth: accessToken,
    }),
  );

  client.interceptors.error.use(async (error, response, request, opts) => {
    const extendedOpts = opts as ResolvedRequestOptions & {
      suppressGlobalErrorToast?: boolean;
    };
    if (extendedOpts.suppressGlobalErrorToast) {
      return error as string;
    }

    const method = request.method.toUpperCase();
    if (READ_METHODS.has(method)) {
      return error as string;
    }

    const status = response?.status;
    /** Ожидаемый конфликт при снятии сфер: экран показывает свой диалог без глобального тоста. */
    if (
      status === 409 &&
      typeof error === "object" &&
      error !== null &&
      (error as Record<string, unknown>).code ===
        "MAJOR_CATEGORY_DISABLE_CONFIRM_REQUIRED"
    ) {
      return error as unknown as string;
    }
    if (status === 401) {
      const now = Date.now();
      if (now - lastUnauthorizedToastAt < UNAUTHORIZED_TOAST_COOLDOWN_MS) {
        return error as string;
      }
      lastUnauthorizedToastAt = now;
    }

    const { title, description } = formatApiErrorForToast({
      error,
      httpStatus: status,
      locale,
    });
    notify.error(title, description);

    return error as string;
  });

  return client;
}
