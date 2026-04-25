/**
 * Минимальный контракт роутера next-intl (`useRouter`).
 */
export type AppRouterBackLike = {
  back: () => void;
  push: (href: string) => void;
};

/**
 * «Назад» по стеку истории браузера, если он не пустой; иначе — явный fallback.
 * Нужен для прямых заходов и открытия в новой вкладке, где `history.length` ≈ 1.
 * Не ломает цепочку обычных переходов по приложению (поиск → карточка → …).
 */
export function goBackOrFallback(
  router: AppRouterBackLike,
  fallback: string,
): void {
  if (typeof window === "undefined") {
    router.push(fallback);
    return;
  }
  if (window.history.length <= 1) {
    router.push(fallback);
    return;
  }
  router.back();
}
