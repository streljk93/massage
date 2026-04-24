import { useEffect, useRef, useState } from "react";

export type UseCursorPaginationSentinelArgs = {
  enabled: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

/**
 * Наблюдатель за «хвостом» списка с курсорной пагинацией: при появлении в viewport
 * вызывает `fetchNextPage`. Повторная подгрузка цепляется за смену `isFetchingNextPage`.
 */
export function useCursorPaginationSentinel({
  enabled,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: UseCursorPaginationSentinelArgs) {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const fetchRef = useRef(fetchNextPage);
  useEffect(() => {
    fetchRef.current = fetchNextPage;
  }, [fetchNextPage]);

  const lastNextFetchAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !sentinel || !hasNextPage || isFetchingNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }
        // Короткий список (например 1 карточка после клиентского фильтра) — sentinel
        // остаётся в зоне видимости; после fetch снова срабатывает сразу → цепочка
        // fetch + мерцание нижнего лоадера. Ограничиваем частоту подгрузок.
        const now = Date.now();
        if (now - lastNextFetchAtRef.current < 450) {
          return;
        }
        lastNextFetchAtRef.current = now;
        void fetchRef.current();
      },
      { root: null, rootMargin: "280px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, sentinel, hasNextPage, isFetchingNextPage]);

  return setSentinel;
}
