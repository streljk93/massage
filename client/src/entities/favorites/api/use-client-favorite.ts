"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createBrowserSdkClient,
  favoritesAdd,
  favoritesList,
  favoritesRemove,
} from "@/shared/api";
import {
  favoriteItemsToKeySet,
  favoritePairKey,
  readGuestFavoriteKeys,
  readUserFavoriteCache,
  writeGuestFavoriteKeys,
  writeUserFavoriteCache,
} from "../lib/favorites-local-storage";
import { favoritesQueryKey } from "../model/favorites-query-key";
import type { FavoriteTargetKind } from "../model/types";

export function useClientFavorite(
  targetKind: FavoriteTargetKind,
  targetId: string,
) {
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;
  const userId = session?.user?.id;

  const pair = useMemo(
    () => favoritePairKey(targetKind, targetId),
    [targetKind, targetId],
  );

  const isAuthed =
    sessionStatus === "authenticated" &&
    Boolean(accessToken && userId && accessToken !== "");

  const [guestVersion, setGuestVersion] = useState(0);
  const guestKeys = useMemo(() => {
    if (typeof window === "undefined") {
      return new Set<string>();
    }
    void guestVersion;
    void sessionStatus;
    return readGuestFavoriteKeys();
  }, [guestVersion, sessionStatus]);

  const favoritesInitial = useMemo(() => {
    if (!userId) {
      return undefined;
    }
    const cached = readUserFavoriteCache(userId);
    if (!cached || cached.size === 0) {
      return undefined;
    }
    return cached;
  }, [userId]);

  const favoritesQuery = useQuery({
    queryKey: favoritesQueryKey(userId),
    enabled: isAuthed,
    ...(favoritesInitial
      ? { initialData: favoritesInitial, initialDataUpdatedAt: 0 }
      : {}),
    queryFn: async () => {
      const client = createBrowserSdkClient(accessToken!, { locale });
      const res = await favoritesList({ client });
      if (res.error || !res.data) {
        throw new Error("favorites_list_failed");
      }
      const set = favoriteItemsToKeySet(res.data.favorites);
      writeUserFavoriteCache(userId!, set);
      return set;
    },
  });

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const client = createBrowserSdkClient(accessToken!, { locale });
      if (next) {
        const res = await favoritesAdd({
          client,
          body: { targetKind, targetId },
        });
        if (res.error) {
          throw res.error;
        }
      } else {
        const res = await favoritesRemove({
          client,
          path: { targetKind, targetId },
        });
        if (res.error) {
          throw res.error;
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const isFavorite = isAuthed
    ? (favoritesQuery.data?.has(pair) ??
      (userId ? readUserFavoriteCache(userId)?.has(pair) : false) ??
      false)
    : guestKeys.has(pair);

  const toggle = useCallback(() => {
    if (sessionStatus === "loading") {
      return;
    }
    if (isAuthed) {
      const cur =
        favoritesQuery.data?.has(pair) ??
        (userId ? readUserFavoriteCache(userId)?.has(pair) : false) ??
        false;
      mutation.mutate(!cur);
      return;
    }
    const set = readGuestFavoriteKeys();
    if (set.has(pair)) {
      set.delete(pair);
    } else {
      set.add(pair);
    }
    writeGuestFavoriteKeys(set);
    setGuestVersion((v) => v + 1);
    void queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }, [
    favoritesQuery.data,
    isAuthed,
    mutation,
    pair,
    queryClient,
    sessionStatus,
    userId,
  ]);

  const isPending = isAuthed && mutation.isPending;

  return {
    isFavorite,
    isPending,
    toggle,
  };
}
