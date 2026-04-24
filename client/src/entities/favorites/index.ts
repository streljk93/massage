export type { FavoriteTargetKind } from "./model/types";
export { favoritesQueryKey } from "./model/favorites-query-key";
export {
  clearGuestFavoriteKeys,
  favoriteItemsToKeySet,
  favoritePairKey,
  parseFavoritePairKey,
  promoteUserCacheToGuestOnLogout,
  readGuestFavoriteKeys,
  readGuestFavoriteKeyList,
  writeGuestFavoriteKeys,
  writeUserFavoriteCache,
} from "./lib/favorites-local-storage";
export { useClientFavorite } from "./api/use-client-favorite";
