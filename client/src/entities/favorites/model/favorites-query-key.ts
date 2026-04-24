export function favoritesQueryKey(userId: string | undefined) {
  return ["favorites", userId] as const;
}
