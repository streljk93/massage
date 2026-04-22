"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { Link } from "@/app/i18n/navigation";
import {
  BookingHistoryCard,
  BookingListCard,
  bookingHistoryDateTagsMuted,
  formatBookingServiceLineClient,
} from "@/entities/booking";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import { homeUser } from "@/widgets/home/lib/mock-data";
import { cn, motion } from "@/shared/lib";
import { confirmAction, notify } from "@/shared/lib/notifications";
import {
  bookingsCancel,
  bookingsList,
  createBrowserSdkClient,
} from "@/shared/api";
import { resolveApiResourceUrl } from "@/shared/api/resolve-api-resource-url";
import {
  vnCalendarYmdString,
  vnTomorrowFromNow,
} from "@/views/specialist-profile/lib/booking-starts-at";
import {
  bookingIsNewTab,
  mapApiStatusToListCard,
} from "../lib/booking-api-to-ui";

type BookingsTab = "new" | "history";

/** Чуть дольше `--motion-duration-slow`, чтобы успели grid + fade на карточке. */
const BOOKING_CANCEL_EXIT_MS = 360;

type ApiBooking = {
  id: string;
  status: string;
  specialistId: string;
  specialistName: string;
  specialistImageUrl?: string | null;
  serviceName: string;
  amount: number | null;
  currency: string;
  startsAt: string;
  endsAt: string;
  pendingExpiresAt?: string | null;
  cancelReason?: string | null;
  statusLabel: string;
};

function specialistAvatarSrc(url: string | null | undefined): string | undefined {
  if (url == null || url === "") {
    return undefined;
  }
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : resolveApiResourceUrl(url);
}

export function BookingsPage() {
  const t = useTranslations("bookings");
  const tRoot = useTranslations();
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [tab, setTab] = useState<BookingsTab>("new");
  const [rows, setRows] = useState<ApiBooking[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [exitingBookingId, setExitingBookingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelLock = useRef(false);
  const exitRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const refreshBookings = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const res = await bookingsList({
      client: createBrowserSdkClient(accessToken),
      query: { locale },
    });
    if (res.error || !res.data) {
      setLoadError(true);
      setRows([]);
      return;
    }
    setLoadError(false);
    setRows(res.data.bookings);
  }, [accessToken, locale]);

  const refreshBookingsRef = useRef(refreshBookings);
  useLayoutEffect(() => {
    refreshBookingsRef.current = refreshBookings;
  }, [refreshBookings]);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await bookingsList({
        client: createBrowserSdkClient(accessToken),
        query: { locale },
      });
      if (cancelled) {
        return;
      }
      if (res.error || !res.data) {
        setLoadError(true);
        setRows([]);
        return;
      }
      setLoadError(false);
      setRows(res.data.bookings);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, locale, sessionStatus]);

  useEffect(() => {
    return () => {
      if (exitRefreshTimeoutRef.current != null) {
        clearTimeout(exitRefreshTimeoutRef.current);
      }
    };
  }, []);

  const handleCancel = useCallback(
    async (bookingId: string) => {
      if (!accessToken || cancelLock.current) {
        return;
      }
      const confirmed = await confirmAction({
        title: t("cancelConfirmTitle"),
        description: t("cancelConfirmDescription"),
        confirmLabel: t("cancelConfirmActionLabel"),
        cancelLabel: t("cancelConfirmDismissLabel"),
        destructive: true,
      });
      if (!confirmed) {
        return;
      }
      cancelLock.current = true;
      setCancellingId(bookingId);
      setCancelError(null);
      try {
        const res = await bookingsCancel({
          client: createBrowserSdkClient(accessToken),
          path: { id: bookingId },
        });
        if (res.error || !res.data) {
          setCancelError(t("cancelError"));
          return;
        }
        notify.success(t("cancelSuccess"));
        setExitingBookingId(bookingId);
        if (exitRefreshTimeoutRef.current != null) {
          clearTimeout(exitRefreshTimeoutRef.current);
        }
        exitRefreshTimeoutRef.current = setTimeout(() => {
          exitRefreshTimeoutRef.current = null;
          void refreshBookings();
          setExitingBookingId(null);
        }, BOOKING_CANCEL_EXIT_MS);
      } finally {
        cancelLock.current = false;
        setCancellingId(null);
      }
    },
    [accessToken, refreshBookings, t],
  );

  const newRows = useMemo(
    () => (rows ?? []).filter((b) => bookingIsNewTab(b.status)),
    [rows],
  );

  const historyRows = useMemo(
    () => (rows ?? []).filter((b) => !bookingIsNewTab(b.status)),
    [rows],
  );

  const listCards = useMemo(() => {
    const now = new Date();
    const todayYmd = vnCalendarYmdString(now);
    const tomorrowYmd = vnCalendarYmdString(vnTomorrowFromNow(now));

    return newRows.map((row) => {
      const start = new Date(row.startsAt);
      const end = new Date(row.endsAt);
      const startYmd = vnCalendarYmdString(start);
      let dateLabel: string;
      if (startYmd === todayYmd) {
        dateLabel = tRoot("booking.today");
      } else if (startYmd === tomorrowYmd) {
        dateLabel = tRoot("booking.tomorrow");
      } else {
        dateLabel = format.dateTime(start, { dateStyle: "medium" });
      }

      const timeRange = `${format.dateTime(start, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })} – ${format.dateTime(end, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })}`;

      const serviceLine =
        row.amount != null
          ? formatBookingServiceLineClient(tRoot, format, {
              serviceLabel: row.serviceName,
              amount: row.amount,
              currency: row.currency,
            })
          : row.serviceName;

      return {
        id: row.id,
        status: mapApiStatusToListCard(row.status),
        pendingExpiresAt: row.pendingExpiresAt,
        specialistProfileHref: `/specialists/${row.specialistId}`,
        providerName: row.specialistName,
        serviceLine,
        dateLabel,
        timeRange,
        avatarSrc: specialistAvatarSrc(row.specialistImageUrl),
      };
    });
  }, [format, newRows, tRoot]);

  const historyCards = useMemo(() => {
    const now = new Date();
    const todayYmd = vnCalendarYmdString(now);
    const tomorrowYmd = vnCalendarYmdString(vnTomorrowFromNow(now));

    return historyRows.map((row) => {
      const start = new Date(row.startsAt);
      const end = new Date(row.endsAt);
      const startYmd = vnCalendarYmdString(start);
      let dateLabel: string;
      if (startYmd === todayYmd) {
        dateLabel = tRoot("booking.today");
      } else if (startYmd === tomorrowYmd) {
        dateLabel = tRoot("booking.tomorrow");
      } else {
        dateLabel = format.dateTime(start, { dateStyle: "medium" });
      }

      const timeRange = `${format.dateTime(start, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })} – ${format.dateTime(end, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })}`;

      const serviceLine =
        row.amount != null
          ? formatBookingServiceLineClient(tRoot, format, {
              serviceLabel: row.serviceName,
              amount: row.amount,
              currency: row.currency,
            })
          : row.serviceName;

      return {
        id: row.id,
        providerName: row.specialistName,
        serviceLine,
        dateLabel,
        timeRange,
        avatarSrc: specialistAvatarSrc(row.specialistImageUrl),
        specialistProfileHref: `/specialists/${row.specialistId}`,
        dateTagsMuted: bookingHistoryDateTagsMuted(row.status),
        statusLabel: row.statusLabel,
      };
    });
  }, [format, historyRows, tRoot]);

  const headerName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    homeUser.firstName;
  const headerFallback = headerName.slice(0, 2).toUpperCase();

  const mainContent = (() => {
    if (sessionStatus === "loading") {
      return (
        <p className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t("loading")}
        </p>
      );
    }
    if (!accessToken) {
      return (
        <p className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t("signInToSee")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {tRoot("profile.signIn")}
          </Link>
        </p>
      );
    }
    if (rows === null) {
      return (
        <p className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t("loading")}
        </p>
      );
    }
    if (loadError) {
      return (
        <p className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-sm text-destructive">
          {t("loadError")}
        </p>
      );
    }
    return null;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <HomeScreenHeader
            title={t("title")}
            avatarAlt={headerName}
            avatarFallback={headerFallback}
          />

          <div
            className="flex rounded-full bg-muted p-1"
            role="tablist"
            aria-label={t("tablistAria")}
          >
            {(
              [
                { id: "new" as const, labelKey: "tabNew" as const },
                { id: "history" as const, labelKey: "tabHistory" as const },
              ] as const
            ).map(({ id, labelKey }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    motion.interactivePressStrong,
                    "min-w-0 flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors",
                    selected
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    setTab(id);
                  }}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5" role="tabpanel">
            {mainContent}

            {cancelError ? (
              <p
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive"
              >
                {cancelError}
              </p>
            ) : null}

            {accessToken && rows !== null && !loadError ? (
              tab === "new" ? (
                listCards.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("emptyNew")}
                  </p>
                ) : (
                  listCards.map((row) => (
                    <BookingListCard
                      key={row.id}
                      status={row.status}
                      pendingExpiresAt={row.pendingExpiresAt}
                      onPendingConfirmationExpired={() =>
                        void refreshBookingsRef.current()
                      }
                      specialistProfileHref={row.specialistProfileHref}
                      providerName={row.providerName}
                      serviceLine={row.serviceLine}
                      dateLabel={row.dateLabel}
                      timeRange={row.timeRange}
                      avatarSrc={row.avatarSrc}
                      onCancel={() => void handleCancel(row.id)}
                      cancelPending={cancellingId === row.id}
                      isExiting={exitingBookingId === row.id}
                    />
                  ))
                )
              ) : historyCards.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("emptyHistory")}
                </p>
              ) : (
                historyCards.map((row) => (
                  <BookingHistoryCard
                    key={row.id}
                    statusLabel={row.statusLabel}
                    providerName={row.providerName}
                    serviceLine={row.serviceLine}
                    dateLabel={row.dateLabel}
                    timeRange={row.timeRange}
                    avatarSrc={row.avatarSrc}
                    specialistProfileHref={row.specialistProfileHref}
                    dateTagsMuted={row.dateTagsMuted}
                    reviewed={false}
                  />
                ))
              )
            ) : null}
          </div>
        </main>

        <HomeBottomNav activeId="bookings" />
      </div>
    </div>
  );
}
