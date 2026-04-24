"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import {
  clearGuestFavoriteKeys,
  favoriteItemsToKeySet,
  parseFavoritePairKey,
  readGuestFavoriteKeys,
  writeUserFavoriteCache,
} from "@/entities/favorites";
import { createBrowserSdkClient, favoritesMerge } from "@/shared/api";

/**
 * После входа: переносит гостевое избранное в БД и обновляет кэш TanStack Query.
 */
export function FavoritesSyncOnAuth() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const locale = useLocale() as AppLocale;

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !userId) {
      return;
    }
    const guest = readGuestFavoriteKeys();
    if (guest.size === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const items = [];
      for (const key of guest) {
        const parsed = parseFavoritePairKey(key);
        if (parsed) {
          items.push(parsed);
        }
      }
      if (items.length === 0) {
        clearGuestFavoriteKeys();
        return;
      }
      const client = createBrowserSdkClient(accessToken, { locale });
      const res = await favoritesMerge({
        client,
        body: { items },
      });
      if (cancelled || res.error || !res.data) {
        return;
      }
      clearGuestFavoriteKeys();
      const set = favoriteItemsToKeySet(res.data.favorites);
      writeUserFavoriteCache(userId, set);
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, locale, queryClient, status, userId]);

  return null;
}
