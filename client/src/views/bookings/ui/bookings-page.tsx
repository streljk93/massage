"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  BookingHistoryCard,
  BookingListCard,
  formatBookingServiceLineClient,
} from "@/entities/booking";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import { homeUser } from "@/widgets/home/lib/mock-data";
import { cn, motion } from "@/shared/lib";
import {
  bookingsHistoryMock,
  bookingsNewMock,
  type BookingsHistoryMockItem,
  type BookingsPageMockItem,
} from "../lib/mock-data";

type BookingsTab = "new" | "history";

export function BookingsPage() {
  const t = useTranslations("bookings");
  const tRoot = useTranslations();
  const format = useFormatter();
  const [tab, setTab] = useState<BookingsTab>("new");

  const newCards = useMemo(
    () =>
      bookingsNewMock.map((row: BookingsPageMockItem) => ({
        ...row,
        serviceLine: formatBookingServiceLineClient(tRoot, format, {
          serviceLabel: tRoot(row.serviceNameKey),
          amount: row.amount,
          currency: row.currency,
        }),
        dateLabel: tRoot(row.dateLabelKey),
      })),
    [tRoot, format],
  );

  const historyCards = useMemo(
    () =>
      bookingsHistoryMock.map((row: BookingsHistoryMockItem) => ({
        ...row,
        serviceLine: formatBookingServiceLineClient(tRoot, format, {
          serviceLabel: tRoot(row.serviceNameKey),
          amount: row.amount,
          currency: row.currency,
        }),
        reviewExcerpt:
          row.reviewed && row.reviewSnippetKey
            ? t(row.reviewSnippetKey)
            : undefined,
      })),
    [tRoot, format, t],
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <HomeScreenHeader
            locationLabel={homeUser.locationLabel}
            title={t("title")}
            avatarAlt={homeUser.firstName}
            avatarFallback={homeUser.firstName.slice(0, 2).toUpperCase()}
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
            {tab === "new" ? (
              newCards.map((row) => (
                <BookingListCard
                  key={row.id}
                  status={row.status}
                  pendingTime={row.pendingTime}
                  providerName={row.providerName}
                  serviceLine={row.serviceLine}
                  dateLabel={row.dateLabel}
                  timeRange={row.timeRange}
                  avatarSrc={row.avatarSrc}
                />
              ))
            ) : historyCards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                {t("emptyHistory")}
              </p>
            ) : (
              historyCards.map((row) => (
                <BookingHistoryCard
                  key={row.id}
                  providerName={row.providerName}
                  serviceLine={row.serviceLine}
                  dateLabel={row.dateDisplay}
                  timeRange={row.timeRange}
                  avatarSrc={row.avatarSrc}
                  reviewed={row.reviewed}
                  rating={row.rating}
                  reviewExcerpt={row.reviewExcerpt}
                />
              ))
            )}
          </div>
        </main>

        <HomeBottomNav activeId="bookings" />
      </div>
    </div>
  );
}
