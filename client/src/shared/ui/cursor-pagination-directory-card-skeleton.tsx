import { Skeleton } from "./skeleton";

/** Карточка-заглушка под элемент каталога (салон / мастер) при курсорной подгрузке. */
export function CursorPaginationDirectoryCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border/60 bg-card p-3">
      <Skeleton className="size-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-[60%] max-w-[14rem]" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[80%]" />
      </div>
    </div>
  );
}

export function CursorPaginationDirectoryListSkeleton({
  count = 3,
}: {
  count?: number;
}) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <CursorPaginationDirectoryCardSkeleton key={i} />
      ))}
    </div>
  );
}
