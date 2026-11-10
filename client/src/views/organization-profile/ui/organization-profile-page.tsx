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
import type { BookableServiceOption } from "@/entities/services";
import type {
  SalonSpecialistPick,
  StaffBookableServiceRow,
} from "@/entities/specialists";
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
import {
  expandIntervalToListingOccupiedSlotKeys,
  specialistAvailableCoversProposed,
  specialistOccupiedOverlapsProposed,
} from "@/shared/lib/listing-booking-interval-slot-keys";
import { bookingStartsAtIsoUtc } from "@/views/specialist-profile/lib/booking-starts-at";
import {
  filterSlotTimesForDuration,
  shortestDurationThatIncludesSlot,
} from "@/views/specialist-profile/lib/filter-slots-for-duration";
import type { OrganizationProfileData } from "../model/organization-profile-data";
import { OrganizationVitrineGalleryCarousel } from "./organization-vitrine-gallery-carousel";
import { OrganizationProfileBookingPanel } from "./organization-profile-booking-panel";
import { trackOrganizationProfileView } from "@/shared/lib/personalization/personalization-track";

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
      categoryShortName: b.categoryShortName,
      majorSlug: b.majorSlug,
      majorName: b.majorName,
      majorSortOrder: b.majorSortOrder,
      durationMinutes: b.durationMinutes,
      priceVndByDuration: b.priceVndByDuration,
      organizationOfferingId: b.organizationOfferingId,
      marketplaceOfferingPriceOptionIds: b.marketplaceOfferingPriceOptionIds,
    }),
  );
}

/**
 * Одна позиция в меню = подкатегория (локализованный shortName), без кастомного названия услуги.
 */
function serviceMenuKeyFromOption(s: BookableServiceOption): string {
  return s.categoryShortName.trim() || s.id;
}

function serviceMenuKeyFromStaff(b: StaffBookableServiceRow): string {
  return b.categoryShortName.trim() || b.id;
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

/** Сводное меню салона: одна карточка на логическую услугу (имя + категория). */
function mergeSalonBookableOptions(
  specialists: SalonSpecialistPick[],
): BookableServiceOption[] {
  const byKey = new Map<string, BookableServiceOption>();
  for (const p of specialists) {
    for (const opt of pickToBookableOptions(p)) {
      const k = serviceMenuKeyFromOption(opt);
      if (!byKey.has(k)) {
        byKey.set(k, opt);
      }
    }
  }
  return [...byKey.values()].sort((a, b) =>
    serviceMenuKeyFromOption(a).localeCompare(
      serviceMenuKeyFromOption(b),
      undefined,
      { numeric: true },
    ),
  );
}

function bookingSlotKeysForDuration(
  calendarDate: string,
  slotTime: string,
  durationMinutes: number,
): Set<string> {
  const startsAtIso = bookingStartsAtIsoUtc({
    calendarDate,
    slotTime,
  });
  const start = new Date(startsAtIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return expandIntervalToListingOccupiedSlotKeys(start, end);
}

function anchorOptionForMenuKey(
  merged: BookableServiceOption[],
  menuKey: string,
): BookableServiceOption | undefined {
  return merged.find((o) => serviceMenuKeyFromOption(o) === menuKey);
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
  const tVitrine = useTranslations("profileVitrine");
  const tApiErrors = useTranslations("apiErrorToast");
  const format = useFormatter();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;
  useEffect(() => {
    trackOrganizationProfileView({
      accessToken: accessToken || undefined,
      organizationId: profile.id,
    });
  }, [profile.id, accessToken]);

  const [activeTab, setActiveTab] = useState<ProfileVitrineTabId>("services");
  const [bookingOpen, setBookingOpen] = useState(false);

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

  const heroGalleryItems = useMemo(() => {
    if (profile.vitrineGallery.length > 0) {
      return profile.vitrineGallery;
    }
    return [{ src: profile.imageSrc, alt: profile.imageAlt }];
  }, [profile]);

  const [selectedServiceMenuKey, setSelectedServiceMenuKey] = useState(() => {
    const merged = mergeSalonBookableOptions(profile.specialists);
    return merged[0] ? serviceMenuKeyFromOption(merged[0]) : "";
  });

  const [selectedSalonSpecialistId, setSelectedSalonSpecialistId] = useState(
    () => {
      const merged = mergeSalonBookableOptions(profile.specialists);
      const k = merged[0] ? serviceMenuKeyFromOption(merged[0]) : "";
      const first = k
        ? profile.specialists.find((p) =>
            p.bookableServices.some(
              (b) => serviceMenuKeyFromStaff(b) === k,
            ),
          )
        : undefined;
      return (
        first?.specialistId ?? profile.specialists[0]?.specialistId ?? ""
      );
    },
  );

  const [durationByMenuKey, setDurationByMenuKey] = useState<
    Record<string, number>
  >(() => {
    const merged = mergeSalonBookableOptions(profile.specialists);
    const init: Record<string, number> = {};
    for (const opt of merged) {
      init[serviceMenuKeyFromOption(opt)] = opt.durationMinutes[0];
    }
    return init;
  });

  const salonMergedBookableOptions = useMemo(
    () => mergeSalonBookableOptions(profile.specialists),
    [profile.specialists],
  );

  const organizationServiceSphereTabs = useMemo(
    () => majorSphereTabsFromBookableRows(salonMergedBookableOptions),
    [salonMergedBookableOptions],
  );

  const [orgSphereFilterSlug, setOrgSphereFilterSlug] = useState("");

  useEffect(() => {
    if (organizationServiceSphereTabs.length <= 1) {
      return;
    }
    setOrgSphereFilterSlug((prev) =>
      prev && organizationServiceSphereTabs.some((x) => x.slug === prev) ?
        prev
      : organizationServiceSphereTabs[0]!.slug,
    );
  }, [organizationServiceSphereTabs]);

  const salonBookableServiceOptions = useMemo(() => {
    if (organizationServiceSphereTabs.length <= 1) {
      return salonMergedBookableOptions;
    }
    const slug =
      orgSphereFilterSlug &&
      organizationServiceSphereTabs.some((x) => x.slug === orgSphereFilterSlug) ?
        orgSphereFilterSlug
      : organizationServiceSphereTabs[0]!.slug;
    return salonMergedBookableOptions.filter((o) => o.majorSlug === slug);
  }, [
    salonMergedBookableOptions,
    organizationServiceSphereTabs,
    orgSphereFilterSlug,
  ]);

  const orgSphereChipValue =
    orgSphereFilterSlug &&
    organizationServiceSphereTabs.some((x) => x.slug === orgSphereFilterSlug) ?
      orgSphereFilterSlug
    : (organizationServiceSphereTabs[0]?.slug ?? "");

  useEffect(() => {
    setSelectedServiceMenuKey((cur) =>
      cur &&
      salonBookableServiceOptions.some(
        (o) => serviceMenuKeyFromOption(o) === cur,
      ) ?
        cur
      : salonBookableServiceOptions[0] ?
        serviceMenuKeyFromOption(salonBookableServiceOptions[0])
      : "",
    );
  }, [salonBookableServiceOptions]);

  const selectedPick = useMemo(
    () =>
      profile.specialists.find(
        (p) => p.specialistId === selectedSalonSpecialistId,
      ),
    [profile.specialists, selectedSalonSpecialistId],
  );

  const selectedServiceRow = useMemo(() => {
    if (!selectedPick || !selectedServiceMenuKey) {
      return undefined;
    }
    const anchor = anchorOptionForMenuKey(
      salonBookableServiceOptions,
      selectedServiceMenuKey,
    );
    if (!anchor) {
      return undefined;
    }
    return findStaffRowForMenuAnchor(
      selectedPick,
      anchor,
      durationByMenuKey[selectedServiceMenuKey],
    );
  }, [
    selectedPick,
    selectedServiceMenuKey,
    durationByMenuKey,
    salonBookableServiceOptions,
  ]);

  const bookableRowId = selectedServiceRow?.id ?? "";

  const selectedService = useMemo((): BookableServiceOption | undefined => {
    if (!selectedServiceRow) {
      return undefined;
    }
    return {
      id: selectedServiceRow.id,
      categoryShortName: selectedServiceRow.categoryShortName,
      majorSlug: selectedServiceRow.majorSlug,
      majorName: selectedServiceRow.majorName,
      majorSortOrder: selectedServiceRow.majorSortOrder,
      durationMinutes: selectedServiceRow.durationMinutes,
      priceVndByDuration: selectedServiceRow.priceVndByDuration,
      organizationOfferingId: selectedServiceRow.organizationOfferingId,
      marketplaceOfferingPriceOptionIds:
        selectedServiceRow.marketplaceOfferingPriceOptionIds,
    };
  }, [selectedServiceRow]);

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
    setBookingOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profileSlotGridKey от slotCalendarDates/timeSlotsByDay
  }, [bookingSlotFromSearch, profile.id, profileSlotGridKey]);

  const urlBookingSlotKey =
    bookingSlotFromSearch != null
      ? `${bookingSlotFromSearch.calendarDate}-${bookingSlotFromSearch.time}-${bookableRowId}-${dayIndex}`
      : null;
  const urlSlotDurationApplyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    urlSlotDurationApplyKeyRef.current = null;
  }, [urlBookingSlotKey]);

  const daySlots = useMemo(
    () => profile.timeSlotsByDay[dayIndex] ?? [],
    [profile.timeSlotsByDay, dayIndex],
  );

  const selectedBookingMinutes = useMemo(() => {
    if (!selectedService) {
      return undefined;
    }
    const m = durationByMenuKey[selectedServiceMenuKey];
    if (m !== undefined && selectedService.durationMinutes.includes(m)) {
      return m;
    }
    return selectedService.durationMinutes[0];
  }, [durationByMenuKey, selectedService, selectedServiceMenuKey]);

  const specialistsWithSelectedMenuService = useMemo(() => {
    if (!selectedServiceMenuKey) {
      return profile.specialists;
    }
    return profile.specialists.filter((p) =>
      p.bookableServices.some(
        (b) => serviceMenuKeyFromStaff(b) === selectedServiceMenuKey,
      ),
    );
  }, [profile.specialists, selectedServiceMenuKey]);

  const filteredDaySlots = useMemo(() => {
    if (selectedBookingMinutes === undefined) {
      return [];
    }
    const durationFiltered = filterSlotTimesForDuration(
      daySlots,
      selectedBookingMinutes,
    );
    const calendarDate = profile.slotCalendarDates[dayIndex];
    if (!calendarDate) {
      return [];
    }
    const hasAvailabilityKeys = specialistsWithSelectedMenuService.some(
      (p) => p.availableListingSlotKeys.length > 0,
    );
    if (!hasAvailabilityKeys) {
      return durationFiltered;
    }
    return durationFiltered.filter((slotTime) => {
      const proposed = bookingSlotKeysForDuration(
        calendarDate,
        slotTime,
        selectedBookingMinutes,
      );
      return specialistsWithSelectedMenuService.some(
        (p) =>
          specialistAvailableCoversProposed(
            p.availableListingSlotKeys,
            proposed,
          ) &&
          !specialistOccupiedOverlapsProposed(
            p.occupiedListingSlotKeys,
            proposed,
          ),
      );
    });
  }, [
    dayIndex,
    daySlots,
    profile.slotCalendarDates,
    selectedBookingMinutes,
    specialistsWithSelectedMenuService,
  ]);

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
      setDurationByMenuKey((prev) => ({
        ...prev,
        [selectedServiceMenuKey]: minDur,
      }));
    }
    urlSlotDurationApplyKeyRef.current = urlBookingSlotKey;
  }, [
    bookingSlotFromSearch,
    dayIndex,
    profile.timeSlotsByDay,
    selectedBookingMinutes,
    selectedService,
    selectedServiceMenuKey,
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
    return bookingSlotKeysForDuration(
      calendarDate,
      effectiveSlot.trim(),
      selectedBookingMinutes,
    );
  }, [
    dayIndex,
    effectiveSlot,
    profile.slotCalendarDates,
    selectedBookingMinutes,
  ]);

  const selectableSpecialistsAtSlot = useMemo(() => {
    if (!proposedBookingSlotKeys || proposedBookingSlotKeys.size === 0) {
      return specialistsWithSelectedMenuService;
    }
    return specialistsWithSelectedMenuService.filter(
      (p) =>
        specialistAvailableCoversProposed(
          p.availableListingSlotKeys,
          proposedBookingSlotKeys,
        ) &&
        !specialistOccupiedOverlapsProposed(
          p.occupiedListingSlotKeys,
          proposedBookingSlotKeys,
        ),
    );
  }, [proposedBookingSlotKeys, specialistsWithSelectedMenuService]);

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

      if (anchorOption) {
        const row = findStaffRowForMenuAnchor(
          pick,
          anchorOption,
          preferredMinutes,
        );
        if (row) {
          const want =
            preferredMinutes !== undefined &&
            row.durationMinutes.includes(preferredMinutes)
              ? preferredMinutes
              : row.durationMinutes[0];
          const mk = serviceMenuKeyFromOption(anchorOption);
          setSelectedServiceMenuKey(mk);
          setDurationByMenuKey((prev) => ({ ...prev, [mk]: want }));
          return;
        }
      }

      const opts = pickToBookableOptions(pick);
      const first = opts[0];
      if (first) {
        setSelectedServiceMenuKey(serviceMenuKeyFromOption(first));
        setDurationByMenuKey((prev) => {
          const next = { ...prev };
          for (const s of opts) {
            const mk = serviceMenuKeyFromOption(s);
            if (next[mk] === undefined) {
              next[mk] = s.durationMinutes[0];
            }
          }
          return next;
        });
      }
    },
    [profile.specialists],
  );

  const onSelectSpecialist = useCallback(
    (specialistId: string) => {
      const anchor = anchorOptionForMenuKey(
        salonBookableServiceOptions,
        selectedServiceMenuKey,
      );
      applySpecialistRemapService(
        specialistId,
        anchor,
        selectedBookingMinutes,
      );
    },
    [
      applySpecialistRemapService,
      salonBookableServiceOptions,
      selectedServiceMenuKey,
      selectedBookingMinutes,
    ],
  );

  useEffect(() => {
    if (!selectedServiceMenuKey) {
      return;
    }
    if (selectedServiceRow) {
      return;
    }
    const anchor = anchorOptionForMenuKey(
      salonBookableServiceOptions,
      selectedServiceMenuKey,
    );
    if (!anchor) {
      return;
    }
    const first = profile.specialists.find((p) =>
      p.bookableServices.some(
        (b) => serviceMenuKeyFromStaff(b) === selectedServiceMenuKey,
      ),
    );
    if (!first) {
      return;
    }
    queueMicrotask(() => {
      applySpecialistRemapService(
        first.specialistId,
        anchor,
        durationByMenuKey[selectedServiceMenuKey] ?? anchor.durationMinutes[0],
      );
    });
  }, [
    applySpecialistRemapService,
    durationByMenuKey,
    profile.specialists,
    salonBookableServiceOptions,
    selectedServiceMenuKey,
    selectedServiceRow,
  ]);

  useEffect(() => {
    const anchor = anchorOptionForMenuKey(
      salonBookableServiceOptions,
      selectedServiceMenuKey,
    );
    if (!selectedService || !anchor || selectableSpecialistsAtSlot.length === 0) {
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
          anchor,
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
    selectedServiceMenuKey,
    salonBookableServiceOptions,
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
      const mktOpts = selectedService.marketplaceOfferingPriceOptionIds;
      const mktOfferingId = selectedService.organizationOfferingId;
      const ix = selectedService.durationMinutes.indexOf(selectedBookingMinutes);
      const offeringPriceOptionId =
        ix >= 0 ? (mktOpts[ix] ?? undefined) : undefined;
      if (
        offeringPriceOptionId == null ||
        offeringPriceOptionId.trim().length === 0
      ) {
        setBookingErrorKey("bookingPickSlotOrganization");
        setBookingPending(false);
        return;
      }
      const body: BookingsCreateData["body"] = {
        specialistId: selectedSalonSpecialistId,
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
    sessionStatus,
    t,
  ]);

  const bookingDisabled =
    bookingPending ||
    profile.specialists.length === 0 ||
    salonBookableServiceOptions.length === 0 ||
    !selectedService ||
    selectableSpecialistsAtSlot.length === 0 ||
    !selectableSpecialistsAtSlot.some(
      (p) => p.specialistId === selectedSalonSpecialistId,
    ) ||
    !selectedSalonSpecialistId ||
    selectedBookingMinutes === undefined ||
    filteredDaySlots.length === 0 ||
    !effectiveSlot.trim();

  const openBooking = useCallback((menuKey?: string) => {
    if (menuKey) {
      setSelectedServiceMenuKey(menuKey);
      const anchor = anchorOptionForMenuKey(
        salonBookableServiceOptions,
        menuKey,
      );
      if (anchor) {
        const first = profile.specialists.find((p) =>
          p.bookableServices.some(
            (b) => serviceMenuKeyFromStaff(b) === menuKey,
          ),
        );
        if (first) {
          applySpecialistRemapService(
            first.specialistId,
            anchor,
            durationByMenuKey[menuKey] ?? anchor.durationMinutes[0],
          );
        }
      }
    }
    setBookingOpen(true);
  }, [
    applySpecialistRemapService,
    durationByMenuKey,
    profile.specialists,
    salonBookableServiceOptions,
  ]);

  const onSelectSalonService = useCallback(
    (svc: BookableServiceOption, menuKey: string) => {
      const nextDur = durationByMenuKey[menuKey] ?? svc.durationMinutes[0];
      setSelectedServiceMenuKey(menuKey);
      setDurationByMenuKey((prev) => ({ ...prev, [menuKey]: nextDur }));
      const first = profile.specialists.find((p) =>
        p.bookableServices.some((b) => serviceMenuKeyFromStaff(b) === menuKey),
      );
      if (first) {
        applySpecialistRemapService(first.specialistId, svc, nextDur);
      }
    },
    [applySpecialistRemapService, durationByMenuKey, profile.specialists],
  );

  const onSelectSalonDuration = useCallback(
    (svc: BookableServiceOption, menuKey: string, m: number) => {
      setDurationByMenuKey((prev) => ({ ...prev, [menuKey]: m }));
      setSelectedServiceMenuKey(menuKey);
      const currentHasService = profile.specialists
        .find((p) => p.specialistId === selectedSalonSpecialistId)
        ?.bookableServices.some(
          (b) => serviceMenuKeyFromStaff(b) === menuKey,
        );
      const targetId =
        currentHasService
          ? selectedSalonSpecialistId
          : profile.specialists.find((p) =>
              p.bookableServices.some(
                (b) => serviceMenuKeyFromStaff(b) === menuKey,
              ),
            )?.specialistId;
      if (targetId) {
        applySpecialistRemapService(targetId, svc, m);
      }
    },
    [
      applySpecialistRemapService,
      profile.specialists,
      selectedSalonSpecialistId,
    ],
  );

  const showBookingFlow =
    profile.specialists.length > 0 &&
    selectedPick !== undefined &&
    salonMergedBookableOptions.length > 0;

  const clientsTag =
    profile.clientsCount >= 1000
      ? `${Math.floor(profile.clientsCount / 100) / 10}k+`
      : String(profile.clientsCount);

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
                {tVitrine("breadcrumbOrganizations")}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="font-medium text-foreground">{profile.name}</li>
          </ol>
        </nav>

        {(profile.publicationModerationStatus === "pending_review" ||
          profile.publicationModerationStatus === "rejected") && (
          <div className="mb-4 lg:mb-0" role="status">
            <div
              className={cn(
                "flex gap-2 rounded-xl border px-3 py-2.5 text-sm leading-snug",
                profile.publicationModerationStatus === "rejected"
                  ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
                  : "border-amber-500/35 bg-amber-500/10 text-foreground",
              )}
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                {profile.publicationModerationStatus === "rejected"
                  ? t("moderationRejected")
                  : t("moderationPending")}
              </p>
            </div>
          </div>
        )}

        <div className="relative">
          <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_minmax(240px,34%)] lg:gap-6 lg:items-start">
            <div className="relative overflow-hidden rounded-[14px] border border-border/60">
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
              <div className="relative aspect-[380/420] w-full">
                <OrganizationVitrineGalleryCarousel
                  items={heroGalleryItems}
                  className="absolute inset-0 h-full min-h-0"
                  slideClassName="h-full min-h-0"
                  showDots
                  sliderAriaLabel={t("gallerySliderAria")}
                  openFullscreenLabel={t("galleryOpenFullscreenAria")}
                  fullscreenTitle={t("galleryFullscreenTitle")}
                  fullscreenCloseLabel={t("galleryFullscreenCloseAria")}
                  formatPhotoProgress={(current, total) =>
                    t("galleryFullscreenProgress", { current, total })
                  }
                />
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-2">
                <h1 className="font-heading text-[30px] font-bold leading-tight tracking-[-0.018em] text-foreground">
                  {profile.name}
                </h1>
                <ProfileHeroRatingLine
                  rating={profile.rating}
                  reviewsCount={profile.reviewsCount}
                  reviewsHref={`/organizations/${profile.id}/reviews`}
                />
                <p className="text-[15px] text-muted-foreground">{profile.addressLine}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-3 py-1.5 text-[13px] text-muted-foreground">
                  {t("stats.yearsValue", { years: profile.yearsInBusiness })}
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
              <ProfileHeroAboutText
                text={profile.description}
                className="hidden lg:block"
              />
            </div>

            <div className="hidden lg:block">
              <ProfilePortfolioPlaceholder variant="hero" />
            </div>
          </div>
        </div>

        <ProfileVitrineTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          subjectKind="organization"
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
                  {salonMergedBookableOptions.map((svc) => {
                    const menuKey = serviceMenuKeyFromOption(svc);
                    const minutes = svc.durationMinutes[0];
                    const price = priceForDuration(svc, minutes);
                    return (
                      <ProfileServiceRow
                        key={menuKey}
                        title={svc.categoryShortName}
                        durationLabel={t("durationMin", { n: minutes })}
                        priceLabel={priceText(price)}
                        ariaLabel={tVitrine("serviceRowAria", {
                          name: svc.categoryShortName,
                        })}
                        onSelect={() => openBooking(menuKey)}
                      />
                    );
                  })}
                </div>
              </section>
              <aside className="hidden lg:block">
                <ProfileReviewsTeaser
                  rating={profile.rating}
                  reviewsCount={profile.reviewsCount}
                  reviewsHref={`/organizations/${profile.id}/reviews`}
                  showSampleReview
                />
              </aside>
            </div>
          ) : null}

          {activeTab === "portfolio" ? <ProfilePortfolioPlaceholder /> : null}

          {activeTab === "reviews" ? (
            <ProfileReviewsTeaser
              rating={profile.rating}
              reviewsCount={profile.reviewsCount}
              reviewsHref={`/organizations/${profile.id}/reviews`}
            />
          ) : null}

          {activeTab === "about" ? (
            <div className="space-y-6">
              <ProfileAboutBlock
                text={profile.description}
                heading={tVitrine("aboutOrganizationTitle")}
              />
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
        <OrganizationProfileBookingPanel
          profile={profile}
          showBookingFlow={showBookingFlow}
          organizationServiceSphereTabs={organizationServiceSphereTabs}
          orgSphereChipValue={orgSphereChipValue}
          onOrgSphereChange={setOrgSphereFilterSlug}
          salonBookableServiceOptions={salonBookableServiceOptions}
          selectedServiceMenuKey={selectedServiceMenuKey}
          durationByMenuKey={durationByMenuKey}
          onSelectSalonService={onSelectSalonService}
          onSelectSalonDuration={onSelectSalonDuration}
          serviceMenuKeyFromOption={serviceMenuKeyFromOption}
          specialistsCount={profile.specialists.length}
          salonMergedCount={salonMergedBookableOptions.length}
          dayIndex={dayIndex}
          onDayIndexChange={setDayIndex}
          daySlots={daySlots}
          filteredDaySlots={filteredDaySlots}
          effectiveSlot={effectiveSlot}
          onSlotChange={setSlot}
          selectedBookingMinutes={selectedBookingMinutes}
          bookingPending={bookingPending}
          formatPrice={priceText}
          specialistsWithSelectedMenuService={
            specialistsWithSelectedMenuService
          }
          selectedSalonSpecialistId={selectedSalonSpecialistId}
          proposedBookingSlotKeys={proposedBookingSlotKeys}
          onSelectSpecialist={onSelectSpecialist}
          specialistAvailableCoversProposed={specialistAvailableCoversProposed}
          specialistOccupiedOverlapsProposed={
            specialistOccupiedOverlapsProposed
          }
        />
      </ProfileBookingDialog>
    </div>
  );
}
