"use client";

import { useCallback, useState } from "react";
import { Star } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createBrowserSdkClient,
  organizationsListReviews,
  specialistsListReviews,
} from "@/shared/api";
import { AppBackButton, Button } from "@/shared/ui";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty";
import {
  HomeBottomNav,
  consumerPageRootClass,
  consumerSubpageContentClass,
} from "@/widgets/home";
import { cn } from "@/shared/lib";

export type EntityReviewsInitial = {
  items: Array<{
    id: string;
    authorName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    publicationModerationStatus?: "approved" | "pending_review" | "rejected";
  }>;
  cursorPage: { nextCursor: string | null; hasMore: boolean };
};

export type EntityReviewsPageProps = {
  kind: "organization" | "specialist";
  entityId: string;
  entityName: string;
  initial: EntityReviewsInitial;
};

export function EntityReviewsPage({
  kind,
  entityId,
  entityName,
  initial,
}: EntityReviewsPageProps) {
  const t = useTranslations("entityReviews");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(
    initial.cursorPage.nextCursor,
  );
  const [hasMore, setHasMore] = useState(initial.cursorPage.hasMore);
  const [loading, setLoading] = useState(false);

  const profileHref =
    kind === "organization"
      ? `/organizations/${entityId}`
      : `/specialists/${entityId}`;

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !nextCursor) {
      return;
    }
    setLoading(true);
    try {
      const client = createBrowserSdkClient(accessToken ?? "", { locale });
      const q = {
        locale,
        cursor: nextCursor,
        limit: 20,
      } as const;
      const res =
        kind === "organization"
          ? await organizationsListReviews({
              client,
              path: { id: entityId },
              query: q,
            })
          : await specialistsListReviews({
              client,
              path: { id: entityId },
              query: q,
            });
      if (res.error || !res.data) {
        return;
      }
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.cursorPage.nextCursor);
      setHasMore(res.data.cursorPage.hasMore);
    } finally {
      setLoading(false);
    }
  }, [accessToken, entityId, hasMore, kind, loading, locale, nextCursor]);

  const title =
    kind === "organization" ? t("titleSalon") : t("titleSpecialist");

  return (
    <div className={consumerPageRootClass()}>
      <div className={consumerSubpageContentClass()}>
        <div className="mb-4 flex items-center gap-2 lg:mb-6">
          <AppBackButton
            fallback={profileHref}
            ariaLabel={t("backAria")}
            className="lg:hidden"
          />
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold leading-tight text-foreground lg:text-2xl">
              {title}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {entityName}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Star aria-hidden className="size-4" strokeWidth={1.75} />
              </EmptyMedia>
              <EmptyTitle>{t("empty")}</EmptyTitle>
              <EmptyDescription className="max-w-xs">
                {t("emptyHint")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((r) => (
              <li
                key={r.id}
                className="overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <p className="min-w-0 text-sm font-semibold text-foreground">
                      {r.authorName}
                    </p>
                    {r.publicationModerationStatus === "pending_review" ? (
                      <span className="inline-flex shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-foreground">
                        {t("reviewPending")}
                      </span>
                    ) : null}
                    {r.publicationModerationStatus === "rejected" ? (
                      <span className="inline-flex shrink-0 rounded-md border border-destructive/35 bg-destructive/10 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-destructive-foreground">
                        {t("reviewRejected")}
                      </span>
                    ) : null}
                  </div>
                  <time
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    dateTime={r.createdAt}
                  >
                    {format.dateTime(new Date(r.createdAt), {
                      dateStyle: "medium",
                    })}
                  </time>
                </div>
                <div
                  className="mt-1 flex items-center gap-0.5"
                  role="img"
                  aria-label={`${r.rating} / 5`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-3.5",
                        i < r.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted/25 text-muted-foreground/30",
                      )}
                      strokeWidth={0}
                      aria-hidden
                    />
                  ))}
                </div>
                {r.comment ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                    {r.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {hasMore && items.length > 0 ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              tone="light"
              className="rounded-full"
              disabled={loading}
              onClick={() => void loadMore()}
            >
              {loading ? t("loading") : t("loadMore")}
            </Button>
          </div>
        ) : null}
      </div>

      <HomeBottomNav activeId="search" />
    </div>
  );
}
