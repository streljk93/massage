"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Heart,
  Info,
  LocateFixed,
  MessageCircle,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";
import { useLocale, useFormatter, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { bookingsCreate, createBrowserSdkClient } from "@/shared/api";
import { priceForDuration, ProfileServicePickCard } from "@/entities/services";
import { Button } from "@/shared/ui/button";
import { Rating } from "@/shared/ui/rating";
import { HomeBottomNav } from "@/widgets/home";
import { useUserGeolocation } from "@/widgets/search-map";
import type { BookingSlotSearch } from "@/shared/lib/profile-booking-initial-from-search";
import { initialDayAndSlotFromSearch } from "@/shared/lib/profile-booking-initial-from-search";
import { cn, motion } from "@/shared/lib";
import { notify } from "@/shared/lib/notifications";
import type { SpecialistProfileData } from "../model/specialist-profile-data";
import { bookingStartsAtIsoUtc } from "../lib/booking-starts-at";
import { filterSlotTimesForDuration } from "../lib/filter-slots-for-duration";

const SearchResultsLeafletMap = dynamic(
  () =>
    import("@/widgets/search-map/ui/search-results-leaflet-map").then((m) => ({
      default: m.SearchResultsLeafletMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full min-h-[280px] items-center justify-center bg-muted/40" />
    ),
  },
);

export type SpecialistProfilePageProps = {
  profile: SpecialistProfileData;
  bookingSlotFromSearch: BookingSlotSearch | null;
};

export function SpecialistProfilePage({
  profile,
  bookingSlotFromSearch,
}: SpecialistProfilePageProps) {
  const t = useTranslations("specialistProfile");
  const format = useFormatter();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;
  const [bookingPending, setBookingPending] = useState(false);
  const [bookingErrorKey, setBookingErrorKey] = useState<
    "bookingPickSlot" | "bookingErrorGeneric" | null
  >(null);

  const [favorite, setFavorite] = useState(false);
  const mapFlyToRef = useRef<((p: [number, number]) => void) | null>(null);
  const { userPosition, requestFromUserGesture } = useUserGeolocation();
  const onMapFlyReady = useCallback(
    (flyTo: (p: [number, number]) => void) => {
      mapFlyToRef.current = flyTo;
    },
    [],
  );
  const mapMarkerItems = useMemo(
    () => [
      {
        id: profile.id,
        lat: profile.lat,
        lng: profile.lng,
        imageSrc: profile.imageSrc,
        name: profile.name,
        rating: profile.rating,
      },
    ],
    [profile],
  );
  const { dayIndex: initialDayIndex, slot: initialSlot } =
    initialDayAndSlotFromSearch(profile, bookingSlotFromSearch);
  const [dayIndex, setDayIndex] = useState(initialDayIndex);
  const [slot, setSlot] = useState(initialSlot);

  const daySlots = useMemo(
    () => profile.timeSlotsByDay[dayIndex] ?? [],
    [profile.timeSlotsByDay, dayIndex],
  );
  const [serviceId, setServiceId] = useState(profile.services[0]?.id ?? "");
  const [durationByService, setDurationByService] = useState<
    Record<string, number>
  >(() => {
    const init: Record<string, number> = {};
    for (const s of profile.services) {
      init[s.id] = s.durationMinutes[0];
    }
    return init;
  });

  const nameParts = useMemo(
    () => profile.name.trim().split(/\s+/).filter(Boolean),
    [profile.name],
  );
  const nameLine1 = nameParts[0] ?? "";
  const nameLine2 = nameParts.slice(1).join(" ");

  const selectedService = useMemo(
    () => profile.services.find((s) => s.id === serviceId),
    [profile.services, serviceId],
  );

  const selectedBookingMinutes = useMemo(() => {
    if (!selectedService) {
      return undefined;
    }
    return (
      durationByService[serviceId] ?? selectedService.durationMinutes[0]
    );
  }, [durationByService, selectedService, serviceId]);

  const filteredDaySlots = useMemo(() => {
    if (selectedBookingMinutes === undefined) {
      return [];
    }
    return filterSlotTimesForDuration(daySlots, selectedBookingMinutes);
  }, [daySlots, selectedBookingMinutes]);

  const effectiveSlot = useMemo(() => {
    if (filteredDaySlots.length === 0) {
      return "";
    }
    if (filteredDaySlots.includes(slot)) {
      return slot;
    }
    return filteredDaySlots[0] ?? "";
  }, [filteredDaySlots, slot]);

  const bookingPriceVnd =
    selectedService && selectedBookingMinutes !== undefined
      ? priceForDuration(selectedService, selectedBookingMinutes)
      : undefined;

  const priceText = (vnd: number) =>
    format.number(vnd, {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });

  const onBooking = useCallback(async () => {
    setBookingErrorKey(null);
    if (bookingPending) {
      return;
    }
    if (sessionStatus === "loading") {
      return;
    }
    if (!accessToken) {
      router.push("/login");
      return;
    }
    if (
      !effectiveSlot.trim() ||
      !selectedService ||
      selectedBookingMinutes === undefined
    ) {
      setBookingErrorKey("bookingPickSlot");
      return;
    }
    const slotDayKey = profile.slotDayKeys[dayIndex] ?? "today";
    const startsAt = bookingStartsAtIsoUtc({
      slotDayKey,
      slotTime: effectiveSlot,
    });
    setBookingPending(true);
    try {
      const res = await bookingsCreate({
        client: createBrowserSdkClient(accessToken),
        body: {
          specialistId: profile.id,
          serviceId,
          durationMinutes: selectedBookingMinutes,
          startsAt,
        },
        query: { locale },
      });
      if (res.error || !res.data) {
        setBookingErrorKey("bookingErrorGeneric");
        return;
      }
      notify.success(t("bookingSuccess"));
      router.push("/bookings");
    } catch {
      setBookingErrorKey("bookingErrorGeneric");
    } finally {
      setBookingPending(false);
    }
  }, [
    accessToken,
    bookingPending,
    dayIndex,
    profile.id,
    profile.slotDayKeys,
    router,
    selectedBookingMinutes,
    selectedService,
    serviceId,
    sessionStatus,
    effectiveSlot,
    locale,
    t,
  ]);

  const bookingDisabled =
    bookingPending ||
    profile.services.length === 0 ||
    selectedBookingMinutes === undefined ||
    filteredDaySlots.length === 0 ||
    !effectiveSlot.trim();

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      {/* Hero: мягкий градиент + «ореол» */}
      <div className="relative overflow-hidden pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_100%_-10%,var(--ds-primary)_0%,transparent_55%)] opacity-[0.11]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-muted/90 via-surface-background to-surface-background"
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-lg px-4 pt-3">
          <div className="flex items-start gap-3 sm:gap-5">
            <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
              <Button
                type="button"
                variant="secondary"
                tone="light"
                className="size-11 shrink-0 rounded-full border border-border/50 bg-surface-light/90 backdrop-blur-sm"
                aria-label={t("backAria")}
                onClick={() => router.back()}
              >
                <ArrowLeft className="size-5 text-foreground" aria-hidden />
              </Button>
              <h1 className="font-heading text-[1.75rem] font-semibold leading-[1.12] tracking-tight text-foreground sm:text-[1.95rem]">
                {nameLine1 ? (
                  <span className="block">{nameLine1}</span>
                ) : null}
                {nameLine2 ? (
                  <span className="block text-foreground/88">{nameLine2}</span>
                ) : null}
              </h1>
              <Rating
                value={profile.rating}
                className="[&_span:last-child]:text-xs [&_span:last-child]:text-muted-foreground"
              />
              {profile.servicesLine.trim() ? (
                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                  {profile.servicesLine}
                </p>
              ) : null}
            </div>

            {/* Портрет: скругление + лёгкая маска снизу */}
            <div
              className="pointer-events-none relative h-[13.25rem] w-[9.75rem] shrink-0 overflow-hidden rounded-[1.65rem] border border-border/45 bg-muted/25 sm:h-[14.5rem] sm:w-[11rem]"
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.imageSrc}
                alt=""
                className="size-full object-cover object-[center_12%] [mask-image:linear-gradient(to_bottom,black_72%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_72%,transparent)]"
              />
            </div>
          </div>
        </div>

        {/* Основной блок: одна карточка на контент */}
        <div className="relative z-10 mx-auto mt-4 w-full max-w-lg px-4">
          <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-card">
            {/* Панель действий */}
            <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/25 px-3 py-2.5 sm:px-4">
              <Button
                type="button"
                variant="secondary"
                tone="light"
                className="h-10 gap-2 rounded-full border border-border/45 bg-card px-4 text-sm font-medium hover:bg-card"
              >
                <Info className="size-4 text-primary" aria-hidden />
                {t("details")}
              </Button>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  tone="light"
                  className="size-10 shrink-0 rounded-full border border-border/40 bg-surface-light p-0 sm:size-11"
                  aria-label={t("callAria")}
                >
                  <Phone className="size-[1.15rem] text-foreground" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  tone="light"
                  className="size-10 shrink-0 rounded-full border border-border/40 bg-surface-light p-0 sm:size-11"
                  aria-label={t("messageAria")}
                >
                  <MessageCircle
                    className="size-[1.15rem] text-foreground"
                    aria-hidden
                  />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  tone="light"
                  className="size-10 shrink-0 rounded-full border border-border/40 bg-surface-light p-0 sm:size-11"
                  aria-label={t("favoriteAria")}
                  onClick={() => setFavorite((v) => !v)}
                >
                  <Heart
                    className={cn(
                      "size-[1.15rem] transition-colors",
                      favorite
                        ? "fill-rose-500 text-rose-500"
                        : "text-foreground",
                    )}
                    aria-hidden
                  />
                </Button>
              </div>
            </div>

            {/* Статистика (dense) */}
            <div className="grid grid-cols-3 divide-x divide-border/60 bg-card px-0.5 py-2 sm:px-1">
              <div className="flex flex-col items-center gap-1 px-0.5 py-0.5 text-center sm:px-1">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock className="size-[0.9rem]" aria-hidden />
                </span>
                <p className="text-[0.8125rem] font-semibold leading-tight tabular-nums text-foreground">
                  {t("stats.experienceValue", {
                    years: profile.experienceYears,
                  })}
                </p>
                <p className="text-[0.6rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                  {t("stats.experienceLabel")}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 px-0.5 py-0.5 text-center sm:px-1">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-[0.9rem]" aria-hidden />
                </span>
                <p className="text-[0.8125rem] font-semibold leading-tight tabular-nums text-foreground">
                  {profile.clientsLabel}
                </p>
                <p className="text-[0.6rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                  {t("stats.clientsLabel")}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 px-0.5 py-0.5 text-center sm:px-1">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare className="size-[0.9rem]" aria-hidden />
                </span>
                <p className="text-[0.8125rem] font-semibold leading-tight tabular-nums text-foreground">
                  {format.number(profile.reviewsCount)}
                </p>
                <p className="text-[0.6rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                  {t("stats.reviewsLabel")}
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-border/50 bg-surface-light px-4 py-4 sm:px-5">
              <section className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                    {t("mapTitle")}
                  </h2>
                  <button
                    type="button"
                    className={cn(
                      motion.interactivePressStrong,
                      "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-medium text-foreground outline-none ring-1 ring-border/60 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                    onClick={() => {
                      const fly = mapFlyToRef.current;
                      if (userPosition && fly) {
                        fly(userPosition);
                      }
                      requestFromUserGesture((p) => {
                        mapFlyToRef.current?.(p);
                      });
                    }}
                  >
                    <LocateFixed className="size-4 shrink-0" aria-hidden />
                    {t("mapWhereAmI")}
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/15 [&_.leaflet-control-container]:z-[25]">
                  <div className="h-[280px] min-h-[280px] w-full">
                    <SearchResultsLeafletMap
                      userPosition={userPosition}
                      onMapFlyReady={onMapFlyReady}
                      items={mapMarkerItems}
                      selectedIndex={0}
                      onMarkerSelect={() => {}}
                      userLocationAriaLabel={t("mapUserLocationAria")}
                      interactionGate
                      interactionGateHint={t("mapInteractionGateHint")}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                  {t("selectService")}
                </h2>
                <div className="space-y-2.5">
                  {profile.services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("noServices")}
                    </p>
                  ) : null}
                  {profile.services.map((svc) => {
                    const selected = svc.id === serviceId;
                    const dur =
                      durationByService[svc.id] ?? svc.durationMinutes[0];
                    return (
                      <ProfileServicePickCard
                        key={svc.id}
                        service={svc}
                        selected={selected}
                        selectedDurationMinutes={dur}
                        serviceName={svc.title}
                        formatPrice={priceText}
                        formatDurationMinutes={(m) =>
                          t("durationMin", { n: m })
                        }
                        onSelectService={() => setServiceId(svc.id)}
                        onSelectDuration={(m) => {
                          setDurationByService((prev) => ({
                            ...prev,
                            [svc.id]: m,
                          }));
                          setServiceId(svc.id);
                        }}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                  {t("selectDate")}
                </h2>
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {profile.calendarDays.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">
                      {t("noSlots")}
                    </p>
                  ) : null}
                  {profile.calendarDays.map((d, i) => {
                    const selected = i === dayIndex;
                    return (
                      <button
                        key={`${i}-${d.weekdayKey}-${d.dayOfMonth}`}
                        type="button"
                        onClick={() => {
                          setDayIndex(i);
                          const raw = profile.timeSlotsByDay[i] ?? [];
                          const next =
                            selectedBookingMinutes !== undefined
                              ? filterSlotTimesForDuration(
                                  raw,
                                  selectedBookingMinutes,
                                )
                              : raw;
                          setSlot(next[0] ?? "");
                        }}
                        className={cn(
                          motion.interactivePressStrong,
                          "flex w-[3.25rem] shrink-0 flex-col items-center gap-1 rounded-3xl border px-2 py-3 text-center transition-colors",
                          selected
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-transparent bg-muted/38 text-foreground hover:bg-muted/55",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[0.7rem] font-medium uppercase",
                            selected
                              ? "text-primary"
                              : "text-muted-foreground/75",
                          )}
                        >
                          {t(`weekdays.${d.weekdayKey}`)}
                        </span>
                        <span className="text-base font-semibold tabular-nums">
                          {d.dayOfMonth}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                  {t("selectSlot")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {daySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
                  ) : filteredDaySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("noSlotsForDuration")}
                    </p>
                  ) : (
                    filteredDaySlots.map((time) => {
                      const selected = time === effectiveSlot;
                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSlot(time)}
                          className={cn(
                            motion.interactivePressStrong,
                            "h-10 min-w-[4.25rem] rounded-full border px-4 text-sm font-semibold transition-colors",
                            selected
                              ? "border-primary/45 bg-primary/12 text-primary"
                              : "border-border/55 bg-muted/35 text-foreground hover:bg-muted/55",
                          )}
                        >
                          {time}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {bookingErrorKey ? (
        <p
          role="alert"
          className="mx-auto max-w-lg px-4 pb-2 text-center text-sm text-destructive"
        >
          {t(bookingErrorKey)}
        </p>
      ) : null}

      <HomeBottomNav
        activeId="search"
        actions={
          <Button
            type="button"
            variant="primary"
            className="h-12 w-full rounded-full text-base font-semibold"
            disabled={bookingDisabled}
            aria-busy={bookingPending}
            aria-label={
              bookingPending
                ? t("bookingAriaLoading")
                : bookingPriceVnd !== undefined
                  ? `${t("booking")}, ${priceText(bookingPriceVnd)}`
                  : t("booking")
            }
            onClick={() => void onBooking()}
          >
            {bookingPriceVnd !== undefined ? (
              <>
                {t("booking")}
                <span className="tabular-nums">
                  {" · "}
                  {priceText(bookingPriceVnd)}
                </span>
              </>
            ) : (
              t("booking")
            )}
          </Button>
        }
      />
    </div>
  );
}
