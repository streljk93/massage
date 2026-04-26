"use client";

import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { createBrowserSdkClient, usersMe, usersPatchMe } from "@/shared/api";

/** Приводит значение из API к одной из локалей приложения (или null, если в БД пусто). */
function canonicalAppLocale(raw: unknown): AppLocale | null {
  if (raw == null) {
    return null;
  }
  const s = String(raw).trim().toLowerCase();
  if (s === "" || s === "null" || s === "undefined") {
    return null;
  }
  if (s === "en" || s === "ru" || s === "vi") {
    return s;
  }
  if (s.startsWith("ru")) {
    return "ru";
  }
  if (s.startsWith("vi")) {
    return "vi";
  }
  return null;
}

/**
 * Пишет в API текущую локаль из префикса пути (`/[locale]/...`), чтобы письма и бэкенд
 * использовали ту же локаль, что выбрана в клиенте.
 */
export function SyncUserLocaleWithApp() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;
  const locale = useLocale() as AppLocale;
  const lastOkKey = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) {
      lastOkKey.current = null;
      return;
    }
    const syncKey = `${session?.user?.id ?? "u"}:${locale}`;
    if (lastOkKey.current === syncKey) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const client = createBrowserSdkClient(accessToken, { locale });
      const me = await usersMe({ client });
      if (cancelled || me.error || !me.data) {
        return;
      }
      const storedCanon = canonicalAppLocale(
        (me.data as { locale?: string | null }).locale,
      );
      if (storedCanon === locale) {
        lastOkKey.current = syncKey;
        return;
      }
      const patch = await usersPatchMe({ client, body: { locale } });
      if (!cancelled && !patch.error) {
        lastOkKey.current = syncKey;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, locale, session?.user?.id, status]);

  return null;
}
