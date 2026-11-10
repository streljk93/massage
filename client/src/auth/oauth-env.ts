import { resolveApiOrigin } from "@/shared/lib/api-origin";

/**
 * Кнопки OAuth на экранах входа / регистрации: backend `POST /v1/auth/login/oauth`
 * + `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (GSI).
 * Без origin API — выключено.
 */
export type OAuthEnvFlags = {
  google: boolean;
};

export function getOAuthEnvFlags(): OAuthEnvFlags {
  const hasBackend = Boolean(resolveApiOrigin());
  if (!hasBackend) {
    return { google: false };
  }
  return {
    google: Boolean(
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim(),
    ),
  };
}
