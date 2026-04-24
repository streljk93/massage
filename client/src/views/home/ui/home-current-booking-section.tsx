"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import { Link } from "@/app/i18n/navigation";
import {
  BookingCard,
  formatBookingServiceLineClient,
  type BookingCardProps,
} from "@/entities/booking";
import { Slider } from "@/shared/ui/slider";
import { cn, motion } from "@/shared/lib";
import { bookingsList, createBrowserSdkClient } from "@/shared/api";
import { resolveApiResourceUrl } from "@/shared/api/resolve-api-resource-url";
import { isAfter, parseISO, subMilliseconds } from "date-fns";
import { compareBookingsNewTabPriority } from "@/views/bookings/lib/booking-api-to-ui";
import {
  vnCalendarYmdString,
  vnTomorrowFromNow,
} from "@/views/specialist-profile/lib/booking-starts-at";

/** Виджет на главной: предстоящие визиты в этих статусах (запрос к API — список `status`). */
const HOME_UPCOMING_BOOKING_STATUSES = ["confirmed", "in_progress"] as const;

type ApiBooking = {
  id: string;
  status: string;
  specialistName: string;
  specialistImageUrl?: string | null;
  serviceName: string;
  amount: number | null;
  currency: string;
  startsAt: string;
  endsAt: string;
  pendingExpiresAt?: string | null;
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

function pickUpcomingBookings(rows: ApiBooking[]): ApiBooking[] {
  const cutoff = subMilliseconds(new Date(), 60_000);
  return rows
    .filter((b) => isAfter(parseISO(b.endsAt), cutoff))
    .sort((a, b) =>
      compareBookingsNewTabPriority(
        { status: a.status, startsAt: a.startsAt },
        { status: b.status, startsAt: b.startsAt },
      ),
    );
}

function apiBookingToCardProps(
  booking: ApiBooking,
  tRoot: ReturnType<typeof useTranslations>,
  format: ReturnType<typeof useFormatter>,
  onPendingExpired: () => void,
): BookingCardProps {
  const now = new Date();
  const todayYmd = vnCalendarYmdString(now);
  const tomorrowYmd = vnCalendarYmdString(vnTomorrowFromNow(now));
  const start = parseISO(booking.startsAt);
  const end = parseISO(booking.endsAt);
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
    booking.amount != null
      ? formatBookingServiceLineClient(tRoot, format, {
          serviceLabel: booking.serviceName,
          amount: booking.amount,
          currency: booking.currency,
        })
      : booking.serviceName;

  return {
    specialistName: booking.specialistName,
    serviceLine,
    dateLabel,
    timeRange,
    avatarSrc: specialistAvatarSrc(booking.specialistImageUrl),
    apiBookingStatus: booking.status,
    statusLabel: booking.statusLabel,
    pendingConfirmationExpiresAt:
      booking.status === "pending" ? (booking.pendingExpiresAt ?? null) : null,
    onPendingConfirmationExpired: onPendingExpired,
  };
}

const linkCardClass = cn(
  motion.interactive,
  "block w-full min-w-0 max-w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

/**
 * «Ваши записи» на главной: только при JWT и если есть предстоящие брони
 * в статусах `confirmed` и `in_progress`. Несколько записей — карусель {@link Slider}.
 */
export function HomeCurrentBookingSection() {
  const t = useTranslations("home");
  const tRoot = useTranslations();
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [bookings, setBookings] = useState<ApiBooking[] | null | undefined>(
    undefined,
  );

  const loadBookings = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const res = await bookingsList({
      client: createBrowserSdkClient(accessToken, { locale }),
      query: { locale, status: [...HOME_UPCOMING_BOOKING_STATUSES] },
    });
    if (res.error || !res.data) {
      setBookings(null);
      return;
    }
    setBookings(pickUpcomingBookings(res.data.bookings));
  }, [accessToken, locale]);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }
    if (!accessToken) {
      queueMicrotask(() => {
        setBookings(null);
      });
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await bookingsList({
        client: createBrowserSdkClient(accessToken, { locale }),
        query: { locale, status: [...HOME_UPCOMING_BOOKING_STATUSES] },
      });
      if (cancelled) {
        return;
      }
      if (res.error || !res.data) {
        setBookings(null);
        return;
      }
      setBookings(pickUpcomingBookings(res.data.bookings));
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, locale, sessionStatus]);

  const cardPropsList = useMemo(() => {
    if (!bookings?.length) {
      return [];
    }
    return bookings.map((b) =>
      apiBookingToCardProps(b, tRoot, format, () => void loadBookings()),
    );
  }, [bookings, format, loadBookings, tRoot]);

  if (!bookings?.length) {
    return null;
  }

  const total = bookings.length;

  return (
    <section className="space-y-2.5" aria-labelledby="booking-heading">
      <h2
        id="booking-heading"
        className="font-heading text-lg font-semibold tracking-tight"
      >
        {t("yourBooking")}
      </h2>
      {total === 1 ? (
        <Link
          href="/bookings"
          className={linkCardClass}
          aria-label={t("yourBooking")}
        >
          <BookingCard {...cardPropsList[0]!} />
        </Link>
      ) : (
        <Slider
          dotsPlacement="below"
          dotsAriaLabel={t("bookingsSliderDotsAria")}
          slides={bookings.map((booking, i) => ({
            id: booking.id,
            content: (
              <Link
                href="/bookings"
                className={linkCardClass}
                aria-label={t("bookingSlideAria", {
                  current: i + 1,
                  total,
                })}
              >
                <BookingCard {...cardPropsList[i]!} />
              </Link>
            ),
          }))}
        />
      )}
    </section>
  );
}
