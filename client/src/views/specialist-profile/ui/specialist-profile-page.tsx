"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  LocateFixed,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/app/i18n/navigation";
import { goBackOrFallback } from "@/shared/lib";
import type { AppLocale } from "@/app/i18n/routing";
import { useClientFavorite } from "@/entities/favorites";
import {
  bookingsCreate,
  createBrowserSdkClient,
  type BookingsCreateData,
} from "@/shared/api";
import {
  majorSphereTabsFromBookableRows,
  priceForDuration,
} from "@/entities/services";
import { Button } from "@/shared/ui/button";
import { HomeBottomNav } from "@/widgets/home";
import {
  ProfileAboutBlock,
  ProfileBookingDialog,
  ProfileHeroAboutText,
  ProfileHeroRatingLine,
  ProfilePortfolioPlaceholder,
  ProfileReviewsTeaser,
  ProfileServiceRow,
  ProfileVitrineTabs,
  type ProfileVitrineTabId,
} from "@/widgets/profile-vitrine";
import { useUserGeolocation } from "@/widgets/search-map";
import type { BookingSlotSearch } from "@/shared/lib/booking-slot-search-params";
import {
  interpretBookingCreateResponse,
  type BookingCreateMessageKey,
} from "@/shared/lib/bookings/booking-create-outcome";
import {
  initialDayAndSlotFromSearch,
  resolveSlotLabelInDay,
} from "@/shared/lib/profile-booking-initial-from-search";
import { cn, motion } from "@/shared/lib";
import { notify } from "@/shared/lib/notifications";
import type { SpecialistProfileData } from "../model/specialist-profile-data";
import { bookingStartsAtIsoUtc } from "../lib/booking-starts-at";
import {
  filterSlotTimesForDuration,
  shortestDurationThatIncludesSlot,
} from "../lib/filter-slots-for-duration";
import { trackSpecialistProfileView } from "@/shared/lib/personalization/personalization-track";
import { SpecialistProfileBookingPanel } from "./specialist-profile-booking-panel";

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

type SpecialistBookingErrorKey =
  | "bookingPickSlotSpecialist"
  | BookingCreateMessageKey;

export function SpecialistProfilePage({
  profile,
  bookingSlotFromSearch,
}: SpecialistProfilePageProps) {
  const t = useTranslations("specialistProfile");
  const tVitrine = useTranslations("profileVitrine");
  const tApiErrors = useTranslations("apiErrorToast");
  const format = useFormatter();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [activeTab, setActiveTab] = useState<ProfileVitrineTabId>("services");
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    trackSpecialistProfileView({
      accessToken: accessToken || undefined,
      specialistId: profile.id,
    });
  }, [profile.id, accessToken]);

  const [bookingPending, setBookingPending] = useState(false);
  const [bookingErrorKey, setBookingErrorKey] =
    useState<SpecialistBookingErrorKey | null>(null);

  const {
    isFavorite,
    isPending: favoritePending,
    toggle: toggleFavorite,
  } = useClientFavorite("specialist", profile.id);

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

  const profileSlotGridKey = useMemo(
    () =>
      `${profile.slotCalendarDates.join(",")}|${profile.timeSlotsByDay.map((d) => d.join(",")).join(";")}`,
    [profile.slotCalendarDates, profile.timeSlotsByDay],
  );

  const deepLinkApplySigRef = useRef<string | null>(null);
  useEffect(() => {
    if (bookingSlotFromSearch == null) {
      deepLinkApplySigRef.current = null;
      return;
    }
    const sig = `${profile.id}\0${bookingSlotFromSearch.calendarDate}\0${bookingSlotFromSearch.time}\0${profileSlotGridKey}`;
    if (deepLinkApplySigRef.current === sig) return;
    deepLinkApplySigRef.current = sig;
    const next = initialDayAndSlotFromSearch(
      {
        slotCalendarDates: profile.slotCalendarDates,
        timeSlotsByDay: profile.timeSlotsByDay,
      },
      bookingSlotFromSearch,
    );
    setDayIndex(next.dayIndex);
    setSlot(next.slot);
    setBookingOpen(true);
  }, [bookingSlotFromSearch, profile.id, profileSlotGridKey]);

  const daySlots = useMemo(
    () => profile.timeSlotsByDay[dayIndex] ?? [],
    [profile.timeSlotsByDay, dayIndex],
  );

  const [bookableRowId, setBookableRowId] = useState(
    profile.services[0]?.id ?? "",
  );
  const [durationByBookableRow, setDurationByBookableRow] = useState<
    Record<string, number>
  >(() => {
    const init: Record<string, number> = {};
    for (const s of profile.services) {
      init[s.id] = s.durationMinutes[0];
    }
    return init;
  });

  const serviceSphereTabs = useMemo(
    () => majorSphereTabsFromBookableRows(profile.services),
    [profile.services],
  );
  const [sphereFilterSlug, setSphereFilterSlug] = useState("");
  useEffect(() => {
    if (serviceSphereTabs.length <= 1) return;
    setSphereFilterSlug((prev) =>
      prev && serviceSphereTabs.some((x) => x.slug === prev)
        ? prev
        : serviceSphereTabs[0]!.slug,
    );
  }, [serviceSphereTabs]);

  const visibleBookingServices = useMemo(() => {
    if (serviceSphereTabs.length <= 1) return profile.services;
    const slug =
      sphereFilterSlug &&
      serviceSphereTabs.some((x) => x.slug === sphereFilterSlug)
        ? sphereFilterSlug
        : serviceSphereTabs[0]!.slug;
    return profile.services.filter((s) => s.majorSlug === slug);
  }, [profile.services, sphereFilterSlug, serviceSphereTabs]);

  const sphereChipValue =
    sphereFilterSlug &&
    serviceSphereTabs.some((x) => x.slug === sphereFilterSlug)
      ? sphereFilterSlug
      : (serviceSphereTabs[0]?.slug ?? "");

  useEffect(() => {
    setBookableRowId((cur) =>
      visibleBookingServices.some((s) => s.id === cur)
        ? cur
        : (visibleBookingServices[0]?.id ?? ""),
    );
  }, [visibleBookingServices]);

  const selectedService = useMemo(
    () => profile.services.find((s) => s.id === bookableRowId),
    [profile.services, bookableRowId],
  );

  const selectedBookingMinutes = useMemo(() => {
    if (!selectedService) return undefined;
    return (
      durationByBookableRow[bookableRowId] ?? selectedService.durationMinutes[0]
    );
  }, [durationByBookableRow, selectedService, bookableRowId]);

  const filteredDaySlots = useMemo(() => {
    if (selectedBookingMinutes === undefined) return [];
    return filterSlotTimesForDuration(daySlots, selectedBookingMinutes);
  }, [daySlots, selectedBookingMinutes]);

  const effectiveSlot = useMemo(() => {
    if (filteredDaySlots.length === 0) return "";
    if (filteredDaySlots.includes(slot)) return slot;
    return filteredDaySlots[0] ?? "";
  }, [filteredDaySlots, slot]);

  const urlBookingSlotKey =
    bookingSlotFromSearch != null
      ? `${bookingSlotFromSearch.calendarDate}-${bookingSlotFromSearch.time}-${bookableRowId}-${dayIndex}`
      : null;
  const urlSlotDurationApplyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    urlSlotDurationApplyKeyRef.current = null;
  }, [urlBookingSlotKey]);

  useEffect(() => {
    if (
      urlBookingSlotKey == null ||
      bookingSlotFromSearch == null ||
      !selectedService ||
      selectedBookingMinutes === undefined
    ) {
      return;
    }
    if (urlSlotDurationApplyKeyRef.current === urlBookingSlotKey) return;
    const raw = profile.timeSlotsByDay[dayIndex] ?? [];
    const canonical = resolveSlotLabelInDay(raw, bookingSlotFromSearch.time);
    if (canonical == null) {
      urlSlotDurationApplyKeyRef.current = urlBookingSlotKey;
      return;
    }
    const filtered = filterSlotTimesForDuration(raw, selectedBookingMinutes);
    if (filtered.includes(canonical)) {
      urlSlotDurationApplyKeyRef.current = urlBookingSlotKey;
      return;
    }
    const minDur = shortestDurationThatIncludesSlot(
      raw,
      bookingSlotFromSearch.time,
      selectedService.durationMinutes,
    );
    if (minDur !== undefined && minDur !== selectedBookingMinutes) {
      setDurationByBookableRow((prev) => ({
        ...prev,
        [bookableRowId]: minDur,
      }));
    }
    urlSlotDurationApplyKeyRef.current = urlBookingSlotKey;
  }, [
    bookingSlotFromSearch,
    dayIndex,
    profile.timeSlotsByDay,
    selectedBookingMinutes,
    selectedService,
    bookableRowId,
    urlBookingSlotKey,
  ]);

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

  const openBooking = useCallback((serviceId?: string) => {
    if (serviceId) setBookableRowId(serviceId);
    setBookingOpen(true);
  }, []);

  const onBooking = useCallback(async () => {
    setBookingErrorKey(null);
    if (bookingPending) return;
    if (sessionStatus === "loading") return;
    if (!accessToken) {
      router.push("/login");
      return;
    }
    if (
      !effectiveSlot.trim() ||
      !selectedService ||
      selectedBookingMinutes === undefined
    ) {
      setBookingErrorKey("bookingPickSlotSpecialist");
      return;
    }
    const calendarDate = profile.slotCalendarDates[dayIndex];
    if (!calendarDate) {
      setBookingErrorKey("bookingPickSlotSpecialist");
      return;
    }
    const startsAt = bookingStartsAtIsoUtc({
      calendarDate,
      slotTime: effectiveSlot,
    });
    setBookingPending(true);
    try {
      const mktOpts = selectedService.marketplaceOfferingPriceOptionIds;
      const mktOfferingId = selectedService.organizationOfferingId;
      const ix = selectedService.durationMinutes.indexOf(selectedBookingMinutes);
      const offeringPriceOptionId =
        ix >= 0 ? (mktOpts[ix] ?? undefined) : undefined;
      if (
        offeringPriceOptionId == null ||
        offeringPriceOptionId.trim().length === 0
      ) {
        setBookingErrorKey("bookingPickSlotSpecialist");
        setBookingPending(false);
        return;
      }
      const body: BookingsCreateData["body"] = {
        specialistId: profile.id,
        startsAt,
        organizationOfferingId: mktOfferingId.trim(),
        offeringPriceOptionId: offeringPriceOptionId.trim(),
        durationMinutes: selectedBookingMinutes,
      };

      const res = await bookingsCreate({
        client: createBrowserSdkClient(accessToken, { locale }),
        body,
        query: { locale },
      });
      const outcome = interpretBookingCreateResponse(res);
      if (!outcome.ok) return;
      notify.success(t("bookingSuccess"));
      setBookingOpen(false);
      router.refresh();
      router.push("/bookings");
    } catch {
      /* SDK errors handled elsewhere */
    } finally {
      setBookingPending(false);
    }
  }, [
    accessToken,
    bookingPending,
    dayIndex,
    profile.id,
    profile.slotCalendarDates,
    router,
    selectedBookingMinutes,
    selectedService,
    sessionStatus,
    effectiveSlot,
    locale,
    t,
  ]);

  const bookingDisabled =
    bookingPending ||
    visibleBookingServices.length === 0 ||
    selectedBookingMinutes === undefined ||
    filteredDaySlots.length === 0 ||
    !effectiveSlot.trim();

  const locationLine = [profile.city, profile.addressLine]
    .filter(Boolean)
    .join(" · ");

  const clientsTag =
    profile.doneClientsCount >= 1000
      ? `${Math.floor(profile.doneClientsCount / 100) / 10}k+`
      : String(profile.doneClientsCount);

  return (
    <div className="flex min-h-screen flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-12">
        <nav
          className="hidden pt-4 pb-6 text-sm text-muted-foreground lg:block"
          aria-label="Breadcrumb"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-foreground">
                {tVitrine("breadcrumbHome")}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link href="/search" className="hover:text-foreground">
                {tVitrine("breadcrumbSpecialists")}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="font-medium text-foreground">{profile.name}</li>
          </ol>
        </nav>

        <div className="relative">
          <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_minmax(240px,34%)] lg:gap-6 lg:items-start">
            <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
              <div className="relative overflow-hidden rounded-[14px] border border-border/60 bg-muted/20">
                <Button
                  type="button"
                  variant="secondary"
                  tone="light"
                  className="absolute top-3 left-3 z-20 size-11 rounded-full border border-border/50 bg-card lg:hidden"
                  aria-label={t("backAria")}
                  onClick={() => goBackOrFallback(router, "/search")}
                >
                  <ArrowLeft className="size-5" aria-hidden />
                </Button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.imageSrc}
                  alt={profile.imageAlt}
                  className="aspect-[380/420] w-full object-cover object-[center_12%]"
                />
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-2">
                <h1 className="font-heading text-[30px] font-bold leading-tight tracking-[-0.018em] text-foreground">
                  {profile.name}
                </h1>
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
                  <BadgeCheck className="size-4 shrink-0" aria-hidden />
                  {tVitrine("verified")}
                </p>
                {profile.servicesLine.trim() ? (
                  <p className="text-[15px] text-muted-foreground">
                    {profile.servicesLine}
                  </p>
                ) : null}
                {locationLine ? (
                  <p className="text-[15px] text-muted-foreground">{locationLine}</p>
                ) : null}
                <ProfileHeroRatingLine
                  rating={profile.rating}
                  reviewsCount={profile.reviewsCount}
                  reviewsHref={`/specialists/${profile.id}/reviews`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-3 py-1.5 text-[13px] text-muted-foreground">
                  {tVitrine("experienceTag", {
                    years: profile.experienceYears,
                  })}
                </span>
                <span className="rounded-full bg-muted px-3 py-1.5 text-[13px] text-muted-foreground">
                  {tVitrine("clientsTag", { count: clientsTag })}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  className="h-11 rounded-[10px] px-6 font-semibold"
                  onClick={() => openBooking()}
                >
                  {tVitrine("book")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  tone="light"
                  className="h-11 rounded-[10px] border border-border px-5 font-semibold"
                  disabled={favoritePending}
                  aria-pressed={isFavorite}
                  onClick={() => toggleFavorite()}
                >
                  <Heart
                    className={cn(
                      "mr-2 size-4",
                      isFavorite && "fill-rose-500 text-rose-500",
                    )}
                    aria-hidden
                  />
                  {tVitrine("toFavorites")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  tone="light"
                  className="size-11 rounded-[10px] border border-border p-0"
                  aria-label={tVitrine("shareAria")}
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.share) {
                      void navigator.share({
                        title: profile.name,
                        url: window.location.href,
                      });
                    }
                  }}
                >
                  <Share2 className="size-5" aria-hidden />
                </Button>
              </div>

              {profile.activeWorkplace ? (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  <Link
                    href={`/organizations/${profile.activeWorkplace.id}`}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {profile.activeWorkplace.name}
                  </Link>
                </p>
              ) : null}

              <ProfileHeroAboutText text={profile.bio} className="hidden lg:block" />
            </div>

            <div className="hidden lg:block">
              <ProfilePortfolioPlaceholder variant="hero" />
            </div>
          </div>
        </div>

        {(profile.workplacePublicationModerationStatus === "pending_review" ||
          profile.workplacePublicationModerationStatus === "rejected") && (
          <div className="mb-4" role="status">
            <div
              className={cn(
                "flex gap-2 rounded-xl border px-3 py-2.5 text-sm leading-snug",
                profile.workplacePublicationModerationStatus === "rejected"
                  ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
                  : "border-amber-500/35 bg-amber-500/10 text-foreground",
              )}
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                {profile.workplacePublicationModerationStatus === "rejected"
                  ? t("workplaceModerationRejected")
                  : t("workplaceModerationPending")}
              </p>
            </div>
          </div>
        )}

        <ProfileVitrineTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="mt-2"
        />

        <div className="py-6 lg:py-8">
          {activeTab === "services" ? (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,42%)] lg:items-start">
              <section className="space-y-4">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {tVitrine("servicesTitle")}
                </h2>
                <div className="space-y-2">
                  {profile.services.map((svc) => {
                    const minutes = svc.durationMinutes[0];
                    const price = priceForDuration(svc, minutes);
                    return (
                      <ProfileServiceRow
                        key={svc.id}
                        title={svc.categoryShortName}
                        durationLabel={t("durationMin", { n: minutes })}
                        priceLabel={priceText(price)}
                        ariaLabel={tVitrine("serviceRowAria", {
                          name: svc.categoryShortName,
                        })}
                        onSelect={() => openBooking(svc.id)}
                      />
                    );
                  })}
                </div>
              </section>
              <aside className="hidden lg:block">
                <ProfileReviewsTeaser
                  rating={profile.rating}
                  reviewsCount={profile.reviewsCount}
                  reviewsHref={`/specialists/${profile.id}/reviews`}
                  showSampleReview
                />
              </aside>
            </div>
          ) : null}

          {activeTab === "portfolio" ? (
            <ProfilePortfolioPlaceholder />
          ) : null}

          {activeTab === "reviews" ? (
            <ProfileReviewsTeaser
              rating={profile.rating}
              reviewsCount={profile.reviewsCount}
              reviewsHref={`/specialists/${profile.id}/reviews`}
            />
          ) : null}

          {activeTab === "about" ? (
            <div className="space-y-6">
              <ProfileAboutBlock text={profile.bio} />
              <section className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading text-base font-semibold text-foreground">
                    {t("mapTitle")}
                  </h2>
                  <button
                    type="button"
                    className={cn(
                      motion.interactivePressStrong,
                      "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-medium ring-1 ring-border/60",
                    )}
                    onClick={() => {
                      if (userPosition && mapFlyToRef.current) {
                        mapFlyToRef.current(userPosition);
                      }
                      requestFromUserGesture((p) => {
                        mapFlyToRef.current?.(p);
                      });
                    }}
                  >
                    <LocateFixed className="size-4" aria-hidden />
                    {t("mapWhereAmI")}
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border/60 [&_.leaflet-control-container]:z-[25]">
                  <div className="h-[280px] w-full">
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
            </div>
          ) : null}
        </div>
      </div>

      <HomeBottomNav
        activeId="search"
        actions={
          <Button
            type="button"
            variant="primary"
            className="h-12 w-full rounded-full text-base font-semibold"
            disabled={bookingDisabled}
            aria-busy={bookingPending}
            onClick={() => openBooking()}
          >
            {bookingPriceVnd !== undefined
              ? `${tVitrine("book")} · ${priceText(bookingPriceVnd)}`
              : tVitrine("book")}
          </Button>
        }
      />

      <ProfileBookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        title={tVitrine("bookingDialogTitle")}
        footer={
          <>
            {bookingErrorKey ? (
              <p
                role="alert"
                className="mb-2 text-center text-sm text-destructive"
              >
                {tApiErrors(bookingErrorKey)}
              </p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className="h-12 w-full rounded-xl font-semibold"
              disabled={bookingDisabled}
              aria-busy={bookingPending}
              onClick={() => void onBooking()}
            >
              {bookingPriceVnd !== undefined
                ? `${t("booking")} · ${priceText(bookingPriceVnd)}`
                : t("booking")}
            </Button>
          </>
        }
      >
        <SpecialistProfileBookingPanel
          profile={profile}
          serviceSphereTabs={serviceSphereTabs}
          sphereChipValue={sphereChipValue}
          onSphereChange={setSphereFilterSlug}
          visibleBookingServices={visibleBookingServices}
          bookableRowId={bookableRowId}
          onSelectService={setBookableRowId}
          durationByBookableRow={durationByBookableRow}
          onSelectDuration={(serviceId, minutes) => {
            setDurationByBookableRow((prev) => ({
              ...prev,
              [serviceId]: minutes,
            }));
            setBookableRowId(serviceId);
          }}
          dayIndex={dayIndex}
          onDayIndexChange={setDayIndex}
          effectiveSlot={effectiveSlot}
          onSlotChange={setSlot}
          filteredDaySlots={filteredDaySlots}
          selectedBookingMinutes={selectedBookingMinutes}
          bookingPending={bookingPending}
          formatPrice={priceText}
        />
      </ProfileBookingDialog>
    </div>
  );
}
