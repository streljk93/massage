"use client";

import { AlertTriangle, CalendarDays, Loader2, Wallet } from "lucide-react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { parseISO } from "date-fns";
import { BusinessEmptyState } from "@/entities/business";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistSalonBookings,
} from "@/shared/api";
import type {
  SpecialistsCabinetGetSpecialistSalonBookingsResponse,
  SpecialistsCabinetGetSpecialistSalonBookingsResponses,
} from "@/shared/api/generated/sdk/types.gen";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import type { AppLocale } from "@/app/i18n/routing";
import { cn } from "@/shared/lib";
import { bookingSlotStartTimeReachedClient } from "@/shared/lib/booking-slot-start-client";
import { vnCalendarYmdString } from "@/shared/lib/datetime/vn-listing-datetime";
import { useQuery } from "@tanstack/react-query";

type SalonBookingRow = SpecialistsCabinetGetSpecialistSalonBookingsResponse["bookings"][number];
type BookingStatus = SalonBookingRow["status"];
type AttentionState = {
  pendingExpiringSoon: number;
  readyToStart: number;
  nextVisitStartsAt: string | null;
};

const BUSINESS_DASHBOARD_QK = ["businessDashboard", "active_workplace"] as const;

const STATUS_ORDER: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "done",
  "reject_by_master",
  "reject_by_client",
  "canceled_by_master",
  "canceled_by_client",
  "no_show_by_client",
  "no_show_by_master",
  "expired",
];

const LOST_STATUSES: BookingStatus[] = [
  "reject_by_master",
  "reject_by_client",
  "canceled_by_master",
  "canceled_by_client",
  "no_show_by_client",
  "no_show_by_master",
  "expired",
];

function endOfDayFromYmd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

function aggregateCurrencyTotals(rows: SalonBookingRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount == null) {
      continue;
    }
    const current = totals.get(row.currency) ?? 0;
    totals.set(row.currency, current + row.amount);
  }
  return totals;
}

function formatRevenueSummary(
  totals: Map<string, number>,
  format: ReturnType<typeof useFormatter>,
): string {
  if (totals.size === 0) {
    return "—";
  }
  return Array.from(totals.entries())
    .map(([currency, amount]) =>
      format.number(amount, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    )
    .join(" · ");
}

function formatAverageCheck(
  rows: SalonBookingRow[],
  format: ReturnType<typeof useFormatter>,
): string {
  const withAmount = rows.filter((row) => row.amount != null);
  if (withAmount.length === 0) {
    return "—";
  }
  const byCurrency = new Map<string, { sum: number; count: number }>();
  for (const row of withAmount) {
    const amount = row.amount ?? 0;
    const entry = byCurrency.get(row.currency) ?? { sum: 0, count: 0 };
    entry.sum += amount;
    entry.count += 1;
    byCurrency.set(row.currency, entry);
  }

  return Array.from(byCurrency.entries())
    .map(([currency, stats]) =>
      format.number(stats.sum / Math.max(stats.count, 1), {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    )
    .join(" · ");
}

function formatRelativeStartsAt(
  startsAt: string,
  now: Date,
  format: ReturnType<typeof useFormatter>,
  t: ReturnType<typeof useTranslations>,
): string {
  const date = parseISO(startsAt);
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes <= 0) {
    return t("attention.now");
  }
  if (diffMinutes < 60) {
    return t("attention.inMinutes", { value: diffMinutes });
  }
  if (diffMinutes < 60 * 24) {
    return t("attention.inHours", { value: Math.round(diffMinutes / 60) });
  }
  return format.dateTime(date, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function statusLabel(status: BookingStatus, t: ReturnType<typeof useTranslations>): string {
  return t(`status.${status}`);
}

function dashboardData(
  rows: SalonBookingRow[],
  format: ReturnType<typeof useFormatter>,
): {
  kpi: {
    todayBookingsCount: number;
    confirmedAndInProgressCount: number;
    done7dCount: number;
    cancelNoShow7dCount: number;
  };
  funnel: Array<{ status: BookingStatus; count: number; percent: number }>;
  attention: AttentionState;
  revenue: {
    done7dSummary: string;
    done30dSummary: string;
    averageCheck30d: string;
  };
} {
  const now = new Date();
  const todayYmd = vnCalendarYmdString(now);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);

  let todayBookingsCount = 0;
  let confirmedAndInProgressCount = 0;
  let done7dCount = 0;
  let cancelNoShow7dCount = 0;
  let pendingExpiringSoon = 0;
  let readyToStart = 0;
  let nextVisitStartsAt: string | null = null;

  const statusCounts = new Map<BookingStatus, number>();
  for (const status of STATUS_ORDER) {
    statusCounts.set(status, 0);
  }

  const done7dRows: SalonBookingRow[] = [];
  const done30dRows: SalonBookingRow[] = [];

  for (const row of rows) {
    const startsAt = parseISO(row.startsAt);
    const startsYmd = vnCalendarYmdString(startsAt);
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);

    if (startsYmd === todayYmd) {
      todayBookingsCount += 1;
    }
    if (row.status === "confirmed" || row.status === "in_progress") {
      confirmedAndInProgressCount += 1;
    }

    if (
      startsAt >= sevenDaysAgo &&
      startsAt <= endOfDayFromYmd(todayYmd) &&
      row.status === "done"
    ) {
      done7dCount += 1;
      done7dRows.push(row);
    }

    if (
      startsAt >= sevenDaysAgo &&
      startsAt <= endOfDayFromYmd(todayYmd) &&
      (row.status === "canceled_by_master" ||
        row.status === "canceled_by_client" ||
        row.status === "no_show_by_client" ||
        row.status === "no_show_by_master")
    ) {
      cancelNoShow7dCount += 1;
    }

    if (startsAt >= thirtyDaysAgo && startsAt <= endOfDayFromYmd(todayYmd) && row.status === "done") {
      done30dRows.push(row);
    }

    if (row.status === "pending" && row.pendingExpiresAt != null) {
      const pendingExpiresAt = parseISO(row.pendingExpiresAt);
      const msLeft = pendingExpiresAt.getTime() - now.getTime();
      if (msLeft > 0 && msLeft <= 1000 * 60 * 30) {
        pendingExpiringSoon += 1;
      }
    }

    if (row.status === "confirmed" && bookingSlotStartTimeReachedClient(row.startsAt)) {
      readyToStart += 1;
    }

    if (
      (row.status === "pending" || row.status === "confirmed" || row.status === "in_progress") &&
      startsAt.getTime() >= now.getTime() &&
      (nextVisitStartsAt == null || startsAt.getTime() < parseISO(nextVisitStartsAt).getTime())
    ) {
      nextVisitStartsAt = row.startsAt;
    }
  }

  const total = rows.length;
  const funnel = STATUS_ORDER.map((status) => {
    const count = statusCounts.get(status) ?? 0;
    return {
      status,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  }).filter((item) => item.count > 0);

  return {
    kpi: {
      todayBookingsCount,
      confirmedAndInProgressCount,
      done7dCount,
      cancelNoShow7dCount,
    },
    funnel,
    attention: {
      pendingExpiringSoon,
      readyToStart,
      nextVisitStartsAt,
    },
    revenue: {
      done7dSummary: formatRevenueSummary(
        aggregateCurrencyTotals(done7dRows),
        format,
      ),
      done30dSummary: formatRevenueSummary(
        aggregateCurrencyTotals(done30dRows),
        format,
      ),
      averageCheck30d: formatAverageCheck(done30dRows, format),
    },
  };
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-border/50 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

export function BusinessOnboardingPage() {
  const t = useTranslations("businessOnboarding");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

  const sdk = createBrowserSdkClient(accessToken, { locale });
  const bookingsQuery = useQuery({
    queryKey: [...BUSINESS_DASHBOARD_QK, accessToken, locale],
    enabled: authed,
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistSalonBookings({
        client: sdk,
        query: { scope: "active_workplace", locale },
      });
      if (err || !res) {
        throw err ?? new Error("salon-bookings");
      }
      return res as SpecialistsCabinetGetSpecialistSalonBookingsResponses[200];
    },
  });

  const rows = bookingsQuery.data?.bookings ?? [];
  const computed = dashboardData(rows, format);
  const now = new Date();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("title")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("title")}
        avatarFallback="B"
      />

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">
        {t("dashboardLead")}
      </p>

      {sessionStatus === "loading" ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" aria-busy>
          <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
          <span>{t("loading")}</span>
        </div>
      ) : sessionStatus === "unauthenticated" || !accessToken ? (
        <BusinessEmptyState
          icon={CalendarDays}
          title={t("authTitle")}
          description={t("authHint")}
        />
      ) : bookingsQuery.isError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p className="font-medium">{t("loadErrorTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("loadErrorHint")}</p>
          <button
            type="button"
            className={cn(
              "mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline",
            )}
            onClick={() => void bookingsQuery.refetch()}
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3" aria-label={t("kpiAria")}>
            <MetricCard
              title={t("kpi.todayBookings")}
              value={String(computed.kpi.todayBookingsCount)}
              hint={t("kpi.todayBookingsHint")}
            />
            <MetricCard
              title={t("kpi.liveVisits")}
              value={String(computed.kpi.confirmedAndInProgressCount)}
              hint={t("kpi.liveVisitsHint")}
            />
            <MetricCard
              title={t("kpi.done7d")}
              value={String(computed.kpi.done7dCount)}
              hint={t("kpi.done7dHint")}
            />
            <MetricCard
              title={t("kpi.cancelNoShow7d")}
              value={String(computed.kpi.cancelNoShow7dCount)}
              hint={t("kpi.cancelNoShow7dHint")}
            />
          </section>

          <section
            className="rounded-2xl border border-border/50 bg-card px-4 py-4"
            aria-labelledby="business-funnel-heading"
          >
            <h2
              id="business-funnel-heading"
              className="font-heading text-sm font-semibold tracking-tight text-foreground"
            >
              {t("funnel.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("funnel.hint")}</p>
            {computed.funnel.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("funnel.empty")}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {computed.funnel.map((item) => (
                  <li key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/90">{statusLabel(item.status, t)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.count} · {item.percent}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/65">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.max(4, item.percent)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-border/50 bg-card px-4 py-4">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-primary/80" aria-hidden />
                <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  {t("revenue.title")}
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("revenue.hint")}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("revenue.done7d")}</dt>
                  <dd className="text-right font-medium text-foreground">{computed.revenue.done7dSummary}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("revenue.done30d")}</dt>
                  <dd className="text-right font-medium text-foreground">{computed.revenue.done30dSummary}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("revenue.avgCheck30d")}</dt>
                  <dd className="text-right font-medium text-foreground">{computed.revenue.averageCheck30d}</dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-border/50 bg-card px-4 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-primary/80" aria-hidden />
                <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  {t("attention.title")}
                </h2>
              </div>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{t("attention.pendingExpiringSoon")}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {computed.attention.pendingExpiringSoon}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{t("attention.readyToStart")}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {computed.attention.readyToStart}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{t("attention.nextVisit")}</span>
                  <span className="text-right font-medium text-foreground">
                    {computed.attention.nextVisitStartsAt == null
                      ? t("attention.none")
                      : formatRelativeStartsAt(computed.attention.nextVisitStartsAt, now, format, t)}
                  </span>
                </li>
              </ul>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
