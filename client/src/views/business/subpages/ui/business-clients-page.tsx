"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CalendarClock,
  Loader2,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  canOrganization,
  OrganizationBookingActions,
  OrganizationCapabilities,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistCabinetClients,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  SpecialistsCabinetGetSpecialistCabinetClientsData,
  SpecialistsCabinetGetSpecialistCabinetClientsResponse,
} from "@/shared/api/generated/sdk/types.gen";
import { resolveApiResourceUrl } from "@/shared/lib/resolve-api-resource-url";
import { cn, motion } from "@/shared/lib";
import { useCursorPaginationSentinel } from "@/shared/lib/use-cursor-pagination-sentinel";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  UserAvatar,
} from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

type BusinessClientsSort = NonNullable<
  NonNullable<SpecialistsCabinetGetSpecialistCabinetClientsData["query"]>["sort"]
>;

type BusinessClientItem =
  SpecialistsCabinetGetSpecialistCabinetClientsResponse["clients"][number];
type BusinessClientsT = ReturnType<typeof useTranslations>;

const CLIENTS_LIMIT = 30;
const CLIENTS_QUERY_KEY = ["businessClients"] as const;
const REGULAR_DONE_THRESHOLD = 3;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return (name.trim() || "?").slice(0, 2).toUpperCase();
}

function ClientCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-3.5 w-12 shrink-0 rounded" />
    </div>
  );
}

function ClientCard({
  client,
  formatDate,
  t,
}: {
  client: BusinessClientItem;
  formatDate: (value: string | null) => string;
  t: BusinessClientsT;
}) {
  const avatarSrc =
    client.clientAvatarUrl != null
      ? resolveApiResourceUrl(client.clientAvatarUrl)
      : undefined;
  const hasUpcoming = client.upcomingBookingsCount > 0;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-card-foreground",
        hasUpcoming && "border-l-[3px] border-l-primary",
      )}
    >
      <UserAvatar
        src={avatarSrc}
        alt={client.clientDisplayName}
        fallback={initialsFromName(client.clientDisplayName)}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-semibold leading-snug tracking-tight text-foreground">
          {client.clientDisplayName}
        </p>
        <p className="mt-0.5 text-[0.75rem] tabular-nums text-muted-foreground">
          {t("visitCount", { count: client.doneBookingsCount })}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <p
          className={cn(
            "text-xs font-semibold tabular-nums leading-snug",
            hasUpcoming ? "text-primary" : "text-muted-foreground/70",
          )}
        >
          {hasUpcoming
            ? formatDate(client.nextBookingAt)
            : formatDate(client.lastVisitAt)}
        </p>
        <p
          className={cn(
            "text-[0.65rem] font-medium uppercase tracking-wide leading-snug",
            hasUpcoming ? "text-primary/60" : "text-muted-foreground/50",
          )}
        >
          {hasUpcoming ? t("labelNext") : t("labelLast")}
        </p>
      </div>
    </div>
  );
}

export function BusinessClientsPage() {
  const t = useTranslations("businessClientsPage");
  useSetBusinessPageTitle(t("title"));
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<BusinessClientsSort>("lastBookingDesc");

  // Дебаунс поиска: запросы летят не чаще ~300 мс простоя ввода.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const orgsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } =
        await specialistsCabinetGetSpecialistMyOrganizations({
          client: sdk,
        });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });

  const activeWorkplace = useMemo(() => {
    const orgs = orgsQuery.data?.organizations ?? [];
    return orgs.find((o) => o.isActiveWorkplace === true) ?? null;
  }, [orgsQuery.data?.organizations]);

  const hasActiveWorkplace = activeWorkplace != null;
  const canViewClients = canOrganization(
    activeWorkplace,
    OrganizationCapabilities.BOOKINGS,
    { bookingAction: OrganizationBookingActions.VIEW },
  );

  const clientsQuery = useInfiniteQuery({
    queryKey: [
      ...CLIENTS_QUERY_KEY,
      accessToken,
      locale,
      debouncedSearch,
      sort,
    ] as const,
    enabled: authed && orgsQuery.isSuccess && canViewClients,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data: res, error: err } =
        await specialistsCabinetGetSpecialistCabinetClients({
          client: sdk,
          query: {
            locale,
            sort,
            limit: CLIENTS_LIMIT,
            cursor: pageParam,
            q: debouncedSearch.length > 0 ? debouncedSearch : undefined,
          },
        });
      if (err || !res) {
        throw err ?? new Error("clients");
      }
      return res;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const clients = useMemo(
    () => clientsQuery.data?.pages.flatMap((page) => page.clients) ?? [],
    [clientsQuery.data?.pages],
  );
  const hasSearch = debouncedSearch.length > 0;
  const clientsLoading = canViewClients && clientsQuery.isPending;
  const clientsError = canViewClients && clientsQuery.isError;

  const summary = useMemo(() => {
    let upcoming = 0;
    let regulars = 0;
    for (const c of clients) {
      if (c.upcomingBookingsCount > 0) upcoming += 1;
      if (c.doneBookingsCount >= REGULAR_DONE_THRESHOLD) regulars += 1;
    }
    return { total: clients.length, upcoming, regulars };
  }, [clients]);

  const sentinelRef = useCursorPaginationSentinel({
    enabled: canViewClients && clientsQuery.isSuccess,
    hasNextPage: clientsQuery.hasNextPage,
    isFetchingNextPage: clientsQuery.isFetchingNextPage,
    fetchNextPage: () => void clientsQuery.fetchNextPage(),
  });

  const formatDate = (value: string | null) => {
    if (value == null) return t("dateEmpty");
    return format.dateTime(new Date(value), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  if (sessionStatus === "loading") {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Users}
          title={t("signInTitle")}
          description={t("signInHint")}
        />
      </main>
    );
  }

  const sortLabels: Record<BusinessClientsSort, string> = {
    lastBookingDesc: t("sortLastBooking"),
    nameAsc: t("sortName"),
    visitsDesc: t("sortVisits"),
  };

  const showSummary =
    canViewClients && clientsQuery.isSuccess && summary.total > 0 && !hasSearch;

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-4 px-4 pt-2 pb-6">
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              className="h-9 rounded-full border-0 bg-muted/60"
              startAdornment={<Search className="size-4" aria-hidden />}
              endAdornment={
                searchInput.length > 0 ? (
                  <button
                    type="button"
                    aria-label={t("clearSearch")}
                    onClick={() => setSearchInput("")}
                    className={cn(
                      motion.interactive,
                      "flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                    )}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null
              }
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                tone="light"
                className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium"
                aria-label={t("sortAria")}
              >
                <ArrowUpDown
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="hidden sm:inline">
                  {sortLabels[sort]}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(v) => setSort(v as BusinessClientsSort)}
              >
                <DropdownMenuRadioItem value="lastBookingDesc">
                  {t("sortLastBooking")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="nameAsc">
                  {t("sortName")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="visitsDesc">
                  {t("sortVisits")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showSummary ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="tabular-nums font-semibold text-foreground">
            {summary.total}
            {clientsQuery.hasNextPage ? (
              <span className="text-muted-foreground" aria-hidden>
                +
              </span>
            ) : null}
          </span>
          <span>{t("summaryClients")}</span>
          {summary.upcoming > 0 ? (
            <>
              <span className="mx-1 text-border" aria-hidden>
                ·
              </span>
              <CalendarClock
                className="size-3 shrink-0 text-primary"
                aria-hidden
              />
              <span className="tabular-nums font-semibold text-primary">
                {summary.upcoming}
              </span>
              <span className="text-primary/80">{t("summaryUpcoming")}</span>
            </>
          ) : null}
          {summary.regulars > 0 ? (
            <>
              <span className="mx-1 text-border" aria-hidden>
                ·
              </span>
              <span className="tabular-nums font-semibold text-foreground">
                {summary.regulars}
              </span>
              <span>{t("summaryRegulars")}</span>
            </>
          ) : null}
        </div>
      ) : null}

      <section>
        {orgsQuery.isPending || clientsLoading ? (
          <div className="space-y-3" aria-busy aria-label={t("loadingAria")}>
            <ClientCardSkeleton />
            <ClientCardSkeleton />
            <ClientCardSkeleton />
          </div>
        ) : orgsQuery.isError || clientsError ? (
          <div
            className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground"
            role="alert"
          >
            <p className="font-medium">{t("loadError")}</p>
            <button
              type="button"
              className={cn(
                motion.interactive,
                "mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline",
              )}
              onClick={() => {
                if (orgsQuery.isError) void orgsQuery.refetch();
                if (clientsError) void clientsQuery.refetch();
              }}
            >
              {t("retry")}
            </button>
          </div>
        ) : !hasActiveWorkplace ? (
          <BusinessEmptyState
            icon={Users}
            title={t("noWorkplaceTitle")}
            description={t("noWorkplaceHint")}
          />
        ) : !canViewClients ? (
          <BusinessEmptyState
            icon={Users}
            title={t("noAccessTitle")}
            description={t("noAccessHint")}
          />
        ) : clients.length === 0 ? (
          <BusinessEmptyState
            icon={hasSearch ? Search : UserRound}
            title={hasSearch ? t("emptySearchTitle") : t("emptyTitle")}
            description={hasSearch ? t("emptySearchHint") : t("emptyHint")}
          />
        ) : (
          <div className="space-y-3" aria-label={t("listAria")}>
            {clients.map((client) => (
              <ClientCard
                key={client.clientUserId}
                client={client}
                formatDate={formatDate}
                t={t}
              />
            ))}

            {clientsQuery.hasNextPage ? (
              <>
                <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
                {clientsQuery.isFetchingNextPage ? (
                  <div
                    className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"
                    aria-live="polite"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span>{t("loadingMore")}</span>
                  </div>
                ) : (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      tone="light"
                      onClick={() => void clientsQuery.fetchNextPage()}
                      className="rounded-full"
                    >
                      {t("loadMore")}
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
