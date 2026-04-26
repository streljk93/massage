import { signIn } from "next-auth/react";
import type { AppLocale } from "@/app/i18n/routing";

type OauthProvider = "google";

export type BackendOauthBody = {
  provider: OauthProvider;
  idToken: string;
};

const localeToApi = (l: string): "en" | "ru" | "vi" => {
  if (l === "ru" || l === "vi" || l === "en") {
    return l;
  }
  return "en";
};

/**
 * `POST` `/api/auth/login-oauth` → `signIn("credentials", …)` с JWT с бэкенда.
 */
export async function signInViaBackendOauth(
  body: BackendOauthBody,
  appLocale: AppLocale,
) {
  const res = await fetch("/api/auth/login-oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      locale: localeToApi(appLocale),
    }),
  });
  const payload: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, status: res.status, payload };
  }
  const data = payload as {
    user: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
  const sign = await signIn("credentials", {
    userId: data.user.id,
    email: data.user.email,
    name: data.user.name,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    avatarUrl: data.user.avatarUrl === null ? "" : (data.user.avatarUrl ?? ""),
    redirect: false,
  });
  if (sign?.ok) {
    return { ok: true as const };
  }
  return { ok: false as const, signInError: sign?.error, payload: undefined };
}
