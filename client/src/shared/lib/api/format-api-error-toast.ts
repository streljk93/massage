import type { AppLocale } from "@/app/i18n/routing";
import { BOOKING_API_CODE_TO_MESSAGE_KEY } from "@/shared/lib/api/booking-api-error-i18n";
import { extractApiErrorCode } from "@/shared/lib/api/extract-api-error-code";
import apiErrorToastBundle from "@/shared/model/api-error-toast.i18n.json";

type ApiErrorToastRow = Record<string, string>;

function pickApiErrorToast(locale: AppLocale): ApiErrorToastRow {
  const row =
    apiErrorToastBundle.messages[locale] ??
    apiErrorToastBundle.messages.en;
  return row.apiErrorToast as ApiErrorToastRow;
}

function extractNestMessage(error: unknown): string | undefined {
  if (error == null) {
    return undefined;
  }
  if (typeof error === "string") {
    const t = error.trim();
    return t || undefined;
  }
  if (typeof error !== "object") {
    return undefined;
  }
  const o = error as Record<string, unknown>;
  const msg = o.message;
  if (typeof msg === "string") {
    const t = msg.trim();
    return t || undefined;
  }
  if (Array.isArray(msg) && msg.every((x) => typeof x === "string")) {
    const t = msg.join(". ").trim();
    return t || undefined;
  }
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    const inner = msg as Record<string, unknown>;
    if (typeof inner.message === "string") {
      const t = inner.message.trim();
      return t || undefined;
    }
  }
  return undefined;
}

function isGenericHttpNoise(message: string, status: number): boolean {
  const m = message.trim().toLowerCase();
  if (m === "bad request" && status === 400) {
    return true;
  }
  if (m === "unauthorized" && status === 401) {
    return true;
  }
  if (m === "forbidden" && status === 403) {
    return true;
  }
  if (m === "not found" && status === 404) {
    return true;
  }
  if (m === "internal server error" && status >= 500) {
    return true;
  }
  return false;
}

function i18nKeyForApiCode(code: string): string | undefined {
  const bookingKey =
    BOOKING_API_CODE_TO_MESSAGE_KEY[
      code as keyof typeof BOOKING_API_CODE_TO_MESSAGE_KEY
    ];
  if (bookingKey) {
    return bookingKey;
  }
  return undefined;
}

export function formatApiErrorForToast(args: {
  error: unknown;
  httpStatus: number | undefined;
  locale: AppLocale;
}): { title: string; description?: string } {
  const b = pickApiErrorToast(args.locale);

  if (args.httpStatus == null) {
    return { title: b.networkTitle };
  }

  const { httpStatus } = args;

  if (httpStatus === 401) {
    return { title: b.unauthorizedTitle };
  }
  if (httpStatus === 403) {
    return { title: b.forbiddenTitle };
  }
  if (httpStatus === 429) {
    return { title: b.tooManyRequestsTitle };
  }
  if (httpStatus >= 500) {
    return { title: b.serverTitle };
  }

  const code = extractApiErrorCode(args.error);
  if (code) {
    const i18nKey = i18nKeyForApiCode(code);
    if (i18nKey && typeof b[i18nKey] === "string") {
      return { title: b[i18nKey] };
    }
  }

  const nestMsg = extractNestMessage(args.error);
  if (nestMsg && !isGenericHttpNoise(nestMsg, httpStatus)) {
    return { title: nestMsg };
  }

  return { title: b.genericTitle };
}
