"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Building2,
  Heart,
  Info,
  LocateFixed,
  MessageCircle,
  MessageSquare,
  Phone,
  Star,
  Users,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { useClientFavorite } from "@/entities/favorites";
import { bookingsCreate, createBrowserSdkClient } from "@/shared/api";
import { priceForDuration, ProfileServicePickCard } from "@/entities/services";
import type { BookableServiceOption } from "@/entities/services";
import { SalonSpecialistPickCard } from "@/entities/specialists";
import type {
  SalonSpecialistPick,
  StaffBookableServiceRow,
} from "@/entities/specialists";
import { Button } from "@/shared/ui/button";
import { HomeBottomNav } from "@/widgets/home";
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
import {
  expandIntervalToListingOccupiedSlotKeys,
  specialistOccupiedOverlapsProposed,
} from "@/shared/lib/listing-booking-interval-slot-keys";
import { bookingStartsAtIsoUtc } from "@/views/specialist-profile/lib/booking-starts-at";
import {
  filterSlotTimesForDuration,
  shortestDurationThatIncludesSlot,
} from "@/views/specialist-profile/lib/filter-slots-for-duration";
import type { OrganizationProfileData } from "../model/organization-profile-data";

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

function pickToBookableOptions(pick: SalonSpecialistPick | undefined) {
  if (!pick) return [];
  return pick.bookableServices.map(
    (b): BookableServiceOption => ({
      id: b.id,
      title: b.name,
      categoryShortName: b.categoryShortName,
      durationMinutes: b.durationMinutes,
      priceVndByDuration: b.priceVndByDuration,
    }),
  );
}

/**
 * Одна «логическая» услуга в салоне: имя + категория (без цен/минут — они у мастеров различаются).
 * По полному совпадению цен/длительностей других мастеров в списке не было бы.
 */
function serviceMenuKeyFromOption(s: BookableServiceOption): string {
  return `${s.title.trim()}\x1e${s.categoryShortName.trim()}`;
}

function serviceMenuKeyFromStaff(b: StaffBookableServiceRow): string {
  return `${b.name.trim()}\x1e${b.categoryShortName.trim()}`;
}

function findStaffRowForMenuAnchor(
  pick: SalonSpecialistPick,
  anchor: BookableServiceOption,
  preferredMinutes: number | undefined,
): StaffBookableServiceRow | undefined {
  const key = serviceMenuKeyFromOption(anchor);
  const candidates = pick.bookableServices.filter(
    (b) => serviceMenuKeyFromStaff(b) === key,
  );
  if (candidates.length === 0) {
    return undefined;
  }
  if (
    preferredMinutes !== undefined &&
    candidates.some((b) => b.durationMinutes.includes(preferredMinutes))
  ) {
    return candidates.find((b) => b.durationMinutes.includes(preferredMinutes));
  }
  return candidates[0];
}

export type OrganizationProfilePageProps = {
  profile: OrganizationProfileData;
  bookingSlotFromSearch: BookingSlotSearch | null;
};

type OrganizationBookingErrorKey =
  | "bookingPickSlotOrganization"
  | BookingCreateMessageKey;

export function OrganizationProfilePage({
  profile,
  bookingSlotFromSearch,
}: OrganizationProfilePageProps) {
  const t = useTranslations("organizationProfile");
  const tApiErrors = useTranslations("apiErrorToast");
  const format = useFormatter();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [bookingPending, setBookingPending] = useState(false);
  const [bookingErrorKey, setBookingErrorKey] =
    useState<OrganizationBookingErrorKey | null>(null);

  const {
    isFavorite,
    isPending: favoritePending,
    toggle: toggleFavorite,
  } = useClientFavorite("organization", profile.id);
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

  const [selectedSalonSpecialistId, setSelectedSalonSpecialistId] = useState(
    () => profile.specialists[0]?.specialistId ?? "",
  );

  const [serviceId, setServiceId] = useState(() => {
    const pick = profile.specialists[0];
    return pickToBookableOptions(pick)[0]?.id ?? "";
  });
  const [durationByService, setDurationByService] = useState<
    Record<string, number>
  >(() => {
    const pick = profile.specialists[0];
    const opts = pickToBookableOptions(pick);
    const init: Record<string, number> = {};
    for (const s of opts) {
      init[s.id] = s.durationMinutes[0];
    }
    return init;
  });

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
    if (deepLinkApplySigRef.current === sig) {
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profileSlotGridKey от slotCalendarDates/timeSlotsByDay
  }, [bookingSlotFromSearch, profile.id, profileSlotGridKey]);

  const urlBookingSlotKey =
    bookingSlotFromSearch != null
      ? `${bookingSlotFromSearch.calendarDate}-${bookingSlotFromSearch.time}-${serviceId}-${dayIndex}`
      : null;
  const urlSlotDurationApplyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    urlSlotDurationApplyKeyRef.current = null;
  }, [urlBookingSlotKey]);

  const selectedPick = useMemo(
    () =>
      profile.specialists.find(
        (p) => p.specialistId === selectedSalonSpecialistId,
      ),
    [profile.specialists, selectedSalonSpecialistId],
  );

  const bookableServiceOptions = useMemo(
    () => pickToBookableOptions(selectedPick),
    [selectedPick],
  );

  const selectedService = useMemo(
    () => bookableServiceOptions.find((s) => s.id === serviceId),
    [bookableServiceOptions, serviceId],
  );

  const daySlots = useMemo(
    () => profile.timeSlotsByDay[dayIndex] ?? [],
    [profile.timeSlotsByDay, dayIndex],
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

  /** Дефолтная длительность может выкинуть слот из витрины; подбираем минимальную, куда он помещается. */
  useEffect(() => {
    if (
      urlBookingSlotKey == null ||
      bookingSlotFromSearch == null ||
      !selectedService ||
      selectedBookingMinutes === undefined
    ) {
      return;
    }
    if (urlSlotDurationApplyKeyRef.current === urlBookingSlotKey) {
      return;
    }
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- длительность под URL-слот (иначе слот пропадает из сетки)
      setDurationByService((prev) => ({
        ...prev,
        [serviceId]: minDur,
      }));
    }
    urlSlotDurationApplyKeyRef.current = urlBookingSlotKey;
  }, [
    bookingSlotFromSearch,
    dayIndex,
    profile.timeSlotsByDay,
    selectedBookingMinutes,
    selectedService,
    serviceId,
    urlBookingSlotKey,
  ]);

  /** Ячейки сетки 30 мин, пересекающиеся с выбранным интервалом записи. */
  const proposedBookingSlotKeys = useMemo(() => {
    if (selectedBookingMinutes === undefined || !effectiveSlot.trim()) {
      return null;
    }
    const calendarDate = profile.slotCalendarDates[dayIndex];
    if (!calendarDate) {
      return null;
    }
    const startsAtIso = bookingStartsAtIsoUtc({
      calendarDate,
      slotTime: effectiveSlot.trim(),
    });
    const start = new Date(startsAtIso);
    const end = new Date(start.getTime() + selectedBookingMinutes * 60_000);
    return expandIntervalToListingOccupiedSlotKeys(start, end);
  }, [
    dayIndex,
    effectiveSlot,
    profile.slotCalendarDates,
    selectedBookingMinutes,
  ]);

  /** Та же услуга по меню (все такие карточки показываем; занятость — через disabled). */
  const specialistsForSelectedService = useMemo(() => {
    if (!selectedService) {
      return profile.specialists;
    }
    const menuKey = serviceMenuKeyFromOption(selectedService);
    return profile.specialists.filter((p) =>
      p.bookableServices.some((b) => serviceMenuKeyFromStaff(b) === menuKey),
    );
  }, [profile.specialists, selectedService]);

  /** Свободны на выбранный интервал (для автопереключения и кнопки записи). */
  const selectableSpecialistsAtSlot = useMemo(() => {
    if (!proposedBookingSlotKeys || proposedBookingSlotKeys.size === 0) {
      return specialistsForSelectedService;
    }
    return specialistsForSelectedService.filter(
      (p) =>
        !specialistOccupiedOverlapsProposed(
          p.occupiedListingSlotKeys,
          proposedBookingSlotKeys,
        ),
    );
  }, [specialistsForSelectedService, proposedBookingSlotKeys]);

  const applySpecialistRemapService = useCallback(
    (
      specialistId: string,
      anchorOption: BookableServiceOption | undefined,
      preferredMinutes: number | undefined,
    ) => {
      setSelectedSalonSpecialistId(specialistId);
      const pick = profile.specialists.find(
        (p) => p.specialistId === specialistId,
      );
      if (!pick) {
        return;
      }

      const initDurationsForPick = (p: SalonSpecialistPick) => {
        const m: Record<string, number> = {};
        for (const s of pickToBookableOptions(p)) {
          m[s.id] = s.durationMinutes[0];
        }
        return m;
      };

      if (anchorOption) {
        const row = findStaffRowForMenuAnchor(
          pick,
          anchorOption,
          preferredMinutes,
        );
        if (row) {
          const m = initDurationsForPick(pick);
          const want =
            preferredMinutes !== undefined &&
            row.durationMinutes.includes(preferredMinutes)
              ? preferredMinutes
              : row.durationMinutes[0];
          m[row.id] = want;
          setServiceId(row.id);
          setDurationByService(m);
          return;
        }
      }

      const opts = pickToBookableOptions(pick);
      setServiceId(opts[0]?.id ?? "");
      setDurationByService(initDurationsForPick(pick));
    },
    [profile.specialists],
  );

  const onSelectSpecialist = useCallback(
    (specialistId: string) => {
      applySpecialistRemapService(
        specialistId,
        selectedService,
        selectedBookingMinutes,
      );
    },
    [
      applySpecialistRemapService,
      selectedService,
      selectedBookingMinutes,
    ],
  );

  useEffect(() => {
    if (!selectedService || selectableSpecialistsAtSlot.length === 0) {
      return;
    }
    const ok = selectableSpecialistsAtSlot.some(
      (p) => p.specialistId === selectedSalonSpecialistId,
    );
    if (!ok) {
      const nextId = selectableSpecialistsAtSlot[0].specialistId;
      queueMicrotask(() => {
        applySpecialistRemapService(
          nextId,
          selectedService,
          selectedBookingMinutes,
        );
      });
    }
  }, [
    applySpecialistRemapService,
    selectableSpecialistsAtSlot,
    selectedBookingMinutes,
    selectedSalonSpecialistId,
    selectedService,
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
      !selectedSalonSpecialistId ||
      !effectiveSlot.trim() ||
      !selectedService ||
      selectedBookingMinutes === undefined
    ) {
      setBookingErrorKey("bookingPickSlotOrganization");
      return;
    }
    const calendarDate = profile.slotCalendarDates[dayIndex];
    if (!calendarDate) {
      setBookingErrorKey("bookingPickSlotOrganization");
      return;
    }
    const startsAt = bookingStartsAtIsoUtc({
      calendarDate,
      slotTime: effectiveSlot,
    });
    setBookingPending(true);
    try {
      const res = await bookingsCreate({
        client: createBrowserSdkClient(accessToken, { locale }),
        body: {
          specialistId: selectedSalonSpecialistId,
          serviceId,
          durationMinutes: selectedBookingMinutes,
          startsAt,
        },
        query: { locale },
      });
      const outcome = interpretBookingCreateResponse(res);
      if (!outcome.ok) {
        return;
      }
      notify.success(t("bookingSuccess"));
      router.push("/bookings");
    } catch {
      /* неожиданные ошибки вне SDK — тосты не показываем здесь */
    } finally {
      setBookingPending(false);
    }
  }, [
    accessToken,
    bookingPending,
    dayIndex,
    effectiveSlot,
    locale,
    profile.slotCalendarDates,
    router,
    selectedBookingMinutes,
    selectedSalonSpecialistId,
    selectedService,
    serviceId,
    sessionStatus,
    t,
  ]);

  const bookingDisabled =
    bookingPending ||
    profile.specialists.length === 0 ||
    specialistsForSelectedService.length === 0 ||
    selectableSpecialistsAtSlot.length === 0 ||
    !selectableSpecialistsAtSlot.some(
      (p) => p.specialistId === selectedSalonSpecialistId,
    ) ||
    !selectedSalonSpecialistId ||
    bookableServiceOptions.length === 0 ||
    selectedBookingMinutes === undefined ||
    filteredDaySlots.length === 0 ||
    !effectiveSlot.trim();

  const showBookingFlow =
    profile.specialists.length > 0 && selectedPick !== undefined;

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <div className="relative overflow-hidden pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_100%_-10%,var(--ds-primary)_0%,transparent_55%)] opacity-[0.11]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-muted/90 via-surface-background to-surface-background"
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-lg">
          <div className="relative aspect-[375/460] min-h-[16.5rem] w-full overflow-hidden sm:aspect-[375/503] sm:min-h-[18rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.imageSrc}
              alt={profile.imageAlt}
              className="absolute inset-0 size-full object-cover"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"
              aria-hidden
            />

            <div className="absolute top-3 left-3 z-20 sm:top-4 sm:left-4">
              <Button
                type="button"
                variant="secondary"
                tone="light"
                className="size-11 shrink-0 rounded-full border-0 bg-white/75 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/88"
                aria-label={t("backAria")}
                onClick={() => router.back()}
              >
                <ArrowLeft className="size-5" aria-hidden />
              </Button>
            </div>

            <div className="absolute right-0 bottom-0 left-0 z-10 px-4 pb-4">
              <div
                className="rounded-3xl bg-white/[0.22] px-4 py-4 backdrop-blur-2xl backdrop-saturate-150"
              >
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    tone="light"
                    className="h-11 gap-2 rounded-2xl border-0 bg-white/75 px-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm hover:bg-white/88"
                  >
                    <Info className="size-4 text-foreground" aria-hidden />
                    {t("details")}
                  </Button>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      tone="light"
                      className="size-11 shrink-0 rounded-full border-0 bg-white/75 p-0 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/88"
                      aria-label={t("callAria")}
                    >
                      <Phone className="size-[1.15rem]" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      tone="light"
                      className="size-11 shrink-0 rounded-full border-0 bg-white/75 p-0 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/88"
                      aria-label={t("messageAria")}
                    >
                      <MessageCircle className="size-[1.15rem]" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      tone="light"
                      disabled={favoritePending}
                      className="size-11 shrink-0 rounded-full border-0 bg-white/75 p-0 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/88"
                      aria-label={t("favoriteAria")}
                      aria-pressed={isFavorite}
                      onClick={() => toggleFavorite()}
                    >
                      <Heart
                        className={cn(
                          "size-[1.15rem] transition-colors",
                          isFavorite
                            ? "fill-rose-500 text-rose-500"
                            : "text-foreground",
                        )}
                        aria-hidden
                      />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 min-w-0 space-y-2">
                  <h1 className="break-words font-heading text-[1.85rem] font-light leading-snug tracking-tight text-white sm:text-[2rem] sm:leading-snug">
                    {profile.name}
                  </h1>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-white">
                    <span className="inline-flex items-center gap-1">
                      <Star
                        className="size-3.5 fill-amber-300 text-amber-300"
                        strokeWidth={0}
                        aria-hidden
                      />
                      <span className="tabular-nums">
                        {profile.rating.toFixed(1)}
                      </span>
                    </span>
                    <span className="text-white/85">
                      ({format.number(profile.reviewsCount)} {t("reviewsWord")})
                    </span>
                  </p>
                  <p className="text-xs font-semibold leading-snug text-white/90">
                    {profile.addressLine}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-4 w-full max-w-lg px-4">
          <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-card">
            <div className="grid grid-cols-3 divide-x divide-border/60 bg-card px-0.5 py-2 sm:px-1">
              <div className="flex flex-col items-center gap-1 px-0.5 py-0.5 text-center sm:px-1">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Building2 className="size-[0.9rem]" aria-hidden />
                </span>
                <p className="text-[0.8125rem] font-semibold leading-tight tabular-nums text-foreground">
                  {t("stats.yearsValue", { years: profile.yearsInBusiness })}
                </p>
                <p className="text-[0.6rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                  {t("stats.yearsLabel")}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 px-0.5 py-0.5 text-center sm:px-1">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-[0.9rem]" aria-hidden />
                </span>
                <p className="text-[0.8125rem] font-semibold leading-tight tabular-nums text-foreground">
                  {format.number(profile.specialistsCount)}
                </p>
                <p className="text-[0.6rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                  {t("stats.specialistsLabel")}
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

              {showBookingFlow && bookableServiceOptions.length > 0 ? (
                <section className="space-y-2.5">
                  <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                    {t("selectService")}
                  </h2>
                  <div className="space-y-2.5">
                    {bookableServiceOptions.map((svc) => {
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
              ) : showBookingFlow ? (
                <p className="text-sm text-muted-foreground">
                  {t("noServicesForSpecialist")}
                </p>
              ) : null}

              {showBookingFlow && bookableServiceOptions.length > 0 ? (
                <>
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
                            key={profile.slotCalendarDates[i] ?? i}
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
                    {daySlots.length === 0 ? (
                      <p className="px-1 text-sm text-muted-foreground">
                        {t("noSlots")}
                      </p>
                    ) : filteredDaySlots.length === 0 ? (
                      <p className="px-1 text-sm text-muted-foreground">
                        {t("noSlotsForDuration")}
                      </p>
                    ) : (
                      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {filteredDaySlots.map((time) => {
                          const selected = time === effectiveSlot;
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setSlot(time)}
                              className={cn(
                                motion.interactivePressStrong,
                                "h-10 shrink-0 min-w-[4.25rem] rounded-full border px-4 text-sm font-semibold transition-colors",
                                selected
                                  ? "border-primary/45 bg-primary/12 text-primary"
                                  : "border-border/55 bg-muted/35 text-foreground hover:bg-muted/55",
                              )}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              ) : null}

              {specialistsForSelectedService.length > 0 ? (
                <section className="space-y-2.5">
                  <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                    {t("selectSpecialist")}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {specialistsForSelectedService.map((pick, index) => {
                      const scheduleBusy =
                        proposedBookingSlotKeys !== null &&
                        proposedBookingSlotKeys.size > 0 &&
                        specialistOccupiedOverlapsProposed(
                          pick.occupiedListingSlotKeys,
                          proposedBookingSlotKeys,
                        );
                      return (
                        <SalonSpecialistPickCard
                          key={`${pick.specialistId}-${index}`}
                          pick={pick}
                          selected={
                            pick.specialistId === selectedSalonSpecialistId
                          }
                          scheduleDisabled={scheduleBusy}
                          scheduleDisabledLabel={t("specialistBusyThisSlot")}
                          selectLabel={t("specialistSelectCta")}
                          selectedLabel={t("specialistSelectedCta")}
                          profileHref={`/specialists/${pick.specialistId}`}
                          openProfileAriaLabel={t("specialistOpenProfileAria", {
                            name: pick.name,
                          })}
                          showBookableServices={false}
                          onSelect={() =>
                            onSelectSpecialist(pick.specialistId)
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {bookingErrorKey ? (
        <p
          role="alert"
          className="mx-auto max-w-lg px-4 pb-2 text-center text-sm text-destructive"
        >
          {tApiErrors(bookingErrorKey)}
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
