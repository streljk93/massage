import type { FavoriteTargetKind } from "../model/types";

const LS_GUEST = "services-app:favorites:guest";
const lsCacheKey = (userId: string) => `services-app:favorites:cache:${userId}`;

export function favoritePairKey(
  kind: FavoriteTargetKind,
  targetId: string,
): string {
  return `${kind}:${targetId}`;
}

export function parseFavoritePairKey(key: string): {
  targetKind: FavoriteTargetKind;
  targetId: string;
} | null {
  const i = key.indexOf(":");
  if (i <= 0) {
    return null;
  }
  const kind = key.slice(0, i);
  const targetId = key.slice(i + 1);
  if (kind !== "organization" && kind !== "specialist") {
    return null;
  }
  if (!targetId) {
    return null;
  }
  return { targetKind: kind, targetId };
}

function readKeyArray(raw: string | null): string[] {
  if (raw == null || raw === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function readGuestFavoriteKeys(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  return new Set(readKeyArray(window.localStorage.getItem(LS_GUEST)));
}

/** Порядок совпадает с порядком в `localStorage` (как пользователь добавлял в избранное). */
export function readGuestFavoriteKeyList(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  return readKeyArray(window.localStorage.getItem(LS_GUEST));
}

export function writeGuestFavoriteKeys(keys: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LS_GUEST, JSON.stringify([...keys]));
}

export function readUserFavoriteCache(userId: string): Set<string> | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(lsCacheKey(userId));
  if (raw == null) {
    return null;
  }
  const arr = readKeyArray(raw);
  return new Set(arr);
}

export function writeUserFavoriteCache(userId: string, keys: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    lsCacheKey(userId),
    JSON.stringify([...keys]),
  );
}

export function clearUserFavoriteCache(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(lsCacheKey(userId));
}

export function clearGuestFavoriteKeys(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(LS_GUEST);
}

export function promoteUserCacheToGuestOnLogout(userId: string): void {
  const cache = readUserFavoriteCache(userId);
  if (cache && cache.size > 0) {
    writeGuestFavoriteKeys(new Set(cache));
  }
  clearUserFavoriteCache(userId);
}

export function favoriteItemsToKeySet(
  items: { targetKind: FavoriteTargetKind; targetId: string }[],
): Set<string> {
  const out = new Set<string>();
  for (const i of items) {
    out.add(favoritePairKey(i.targetKind, i.targetId));
  }
  return out;
}
