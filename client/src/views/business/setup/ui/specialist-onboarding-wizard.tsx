/* eslint-disable react-hooks/set-state-in-effect -- синхронизация полей с ответом API и debounce поиска организаций */
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/app/i18n/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  defaultWizardStepForApiStep,
  isSpecialistOnboardingComplete,
  maxUiStepAllowed,
} from "@/entities/business";
import { CATALOG_MAJOR_CATEGORY_SLUG } from "@/shared/config/catalog-major-category";
import {
  catalogGetCategoriesByMajorSlug,
  createBrowserSdkClient,
  filesUploadPublic,
  organizationsList,
  usersGetSpecialistOnboarding,
  usersPatchSpecialistOnboardingProfile,
  usersPostCreateOnboardingOrganization,
  usersPostEnsureSpecialist,
  usersPostJoinOnboardingOrganization,
  usersPostSpecialistOnboardingComplete,
  usersPostSpecialistPersonalService,
} from "@/shared/api";
import { resolveApiResourceUrl } from "@/shared/api/resolve-api-resource-url";
import { AddressMapPickerDialog } from "@/widgets/address-map-picker";
import { BusinessScreenHeader } from "@/widgets/business/shell";
import { ChevronDown, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib";
import {
  AvatarPhotoDropzone,
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  SearchAutocomplete,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/shared/ui";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/shadcn/input-group";
const ONB_QK = ["specialistOnboarding"] as const;

type ExperienceKey = "0-1" | "1-3" | "3-5" | "5+";
const EXP_ORDER: readonly ExperienceKey[] = ["0-1", "1-3", "3-5", "5+"];

function yearsToKey(y: number | null | undefined): ExperienceKey | null {
  if (y == null) {
    return null;
  }
  if (y <= 1) {
    return "0-1";
  }
  if (y <= 3) {
    return "1-3";
  }
  if (y <= 5) {
    return "3-5";
  }
  return "5+";
}

function keyToYears(k: ExperienceKey): number {
  if (k === "0-1") {
    return 0;
  }
  if (k === "1-3") {
    return 2;
  }
  if (k === "3-5") {
    return 4;
  }
  return 6;
}

function clampUi(n: number): number {
  if (Number.isNaN(n) || n < 1) {
    return 1;
  }
  if (n > 5) {
    return 5;
  }
  return n;
}

/** Показанная без +84 национальная часть; из ответа API (E.164 и т.д.). */
function parseVnLocalForInput(phone: string | null | undefined): string {
  if (!phone?.trim()) {
    return "";
  }
  let t = phone.trim().replace(/\s/g, "");
  if (t.startsWith("+84")) {
    t = t.slice(3);
  } else if (t.startsWith("84") && t.length > 2) {
    t = t.slice(2);
  }
  return t.replace(/\D/g, "");
}

/** E.164 для Вьетнама из введённых цифр (код +84 фиксирован). */
function toE164Vietnam(nationalDigits: string): string {
  let d = nationalDigits.replace(/\D/g, "");
  if (d.startsWith("0") && d.length >= 2) {
    d = d.slice(1);
  }
  if (d.startsWith("84") && d.length > 2) {
    d = d.slice(2);
  }
  return `+84${d}`;
}

function isPlausibleVnNational(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 12;
}

/** Состояние хранит только цифры; в поле — группы по 3 с пробелом (500 000). */
function formatVndPriceForInput(digits: string): string {
  const d = String(digits).replace(/\D/g, "");
  if (!d) {
    return "";
  }
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function digitsFromVndPriceInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

type Cat = { id: string; slug: string; label: string };

type DurPrice = { minutes: number; priceVnd: string };
type SvcForm = { categoryId: string; durationPrices: DurPrice[] };

function defaultSvc(catId: string): SvcForm {
  return {
    categoryId: catId,
    durationPrices: [
      { minutes: 60, priceVnd: "" },
      { minutes: 90, priceVnd: "" },
    ],
  };
}

const DURATION_MINUTE_STEP_FALLBACK = 30;
/** Согласно API `POST .../me/specialist/services` (Zod) и `input[min]`. */
const DURATION_MINUTES_MIN = 15;
const DURATION_MINUTES_MAX = 1440;

/** Следующая длительность: последняя + тот же шаг, что между предыдущей и последней. */
function nextMinutesWhenAddingDuration(durations: DurPrice[]): number {
  const n = durations.length;
  if (n < 1) {
    return 60;
  }
  const last = durations[n - 1]!.minutes;
  let next: number;
  if (n >= 2) {
    const prev = durations[n - 2]!.minutes;
    const step = last - prev;
    if (step > 0) {
      next = last + step;
    } else {
      next = last + DURATION_MINUTE_STEP_FALLBACK;
    }
  } else {
    next = last + DURATION_MINUTE_STEP_FALLBACK;
  }
  return Math.min(DURATION_MINUTES_MAX, Math.max(DURATION_MINUTES_MIN, next));
}

function OnboardingStepper({
  current,
  total,
  aria,
}: {
  current: number;
  total: number;
  aria: string;
}) {
  return (
    <div className="flex w-full max-w-md gap-1" role="list" aria-label={aria}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={`seg-${i}`}
          role="listitem"
          className={cn(
            "h-1.5 min-w-0 flex-1 rounded-full transition-colors",
            i < current ? "bg-foreground" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

export function SpecialistOnboardingWizard() {
  const t = useTranslations("specialistOnboarding");
  const tSetup = useTranslations("specialistAccountSetup");
  const topChromeRef = useRef<HTMLDivElement | null>(null);
  const bottomChromeRef = useRef<HTMLDivElement | null>(null);
  const [topChromeHeightPx, setTopChromeHeightPx] = useState(168);
  const [bottomChromeHeightPx, setBottomChromeHeightPx] = useState(100);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qStep = searchParams.get("step");
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );
  const { data: onboard, isLoading, refetch } = useQuery({
    queryKey: [...ONB_QK, accessToken, locale],
    enabled: sessionStatus === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await usersGetSpecialistOnboarding({ client: sdk });
      if (error || !data) {
        throw new Error("onboarding");
      }
      return data;
    },
  });

  const apiStep = onboard?.onboardingStep ?? 1;
  const spec = onboard?.specialist as
    | {
        bio?: string | null;
        experienceYears?: number | null;
        imageUrl?: string | null;
        userName?: string;
        userPhone?: string | null;
        massage?: {
          pressureLevel?: number | null;
          pressureAdaptsToClient?: boolean | null;
        } | null;
        activeOrganizationId?: string | null;
        pendingWorkplaceJoinRequest?: {
          id: string;
          organizationId: string;
          organizationName: string;
        } | null;
      }
    | null
    | undefined;

  const [formError, setFormError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [pName, setPName] = useState("");
  const [pPhoneLocal, setPPhoneLocal] = useState("");
  const [pBio, setPBio] = useState("");
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoObjectUrl, setPendingPhotoObjectUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pExp, setPExp] = useState<ExperienceKey | null>(null);
  const [strength, setStrength] = useState(3);
  const [adapt, setAdapt] = useState(true);
  const [services, setServices] = useState<SvcForm[]>([]);
  /** `false` = свернуто; нет ключа / `true` = развернуто */
  const [servicePanelOpen, setServicePanelOpen] = useState<Record<number, boolean>>({});
  const [orgQ, setOrgQ] = useState("");
  const [orgHits, setOrgHits] = useState<
    Array<{ id: string; name: string; addressLine: string | null; city?: string | null }>
  >([]);
  const [orgPicked, setOrgPicked] = useState<string | null>(null);
  /** `false` после выбора из списка; снова `true` при фокусе/редактировании поля. */
  const [orgSuggestOpen, setOrgSuggestOpen] = useState(true);
  const [orgPending, setOrgPending] = useState(false);
  const [createSalonOpen, setCreateSalonOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  /** Текст выбранного адреса после геокодирования с карты. */
  const [newOrgAddrQ, setNewOrgAddrQ] = useState("");
  /** JSON `{ "p": provider, "i": placeId }` для сохранённого placeReference. */
  const [newOrgPlacePicked, setNewOrgPlacePicked] = useState<string | null>(null);
  const [orgAddressMapOpen, setOrgAddressMapOpen] = useState(false);
  const [orgAddressMapNonce, setOrgAddressMapNonce] = useState(0);
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgWebsite, setNewOrgWebsite] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [newOrgYears, setNewOrgYears] = useState("");
  const [newOrgCategoryIds, setNewOrgCategoryIds] = useState<Set<string>>(new Set());
  const [pendingOrgPhotoFile, setPendingOrgPhotoFile] = useState<File | null>(null);
  const [pendingOrgPhotoObjectUrl, setPendingOrgPhotoObjectUrl] = useState<string | null>(null);
  const [createOrgSubmitting, setCreateOrgSubmitting] = useState(false);
  const [workplaceSubmitting, setWorkplaceSubmitting] = useState(false);
  const [introSubmitting, setIntroSubmitting] = useState(false);
  const [servicesSubmitting, setServicesSubmitting] = useState(false);
  const [doneSubmitting, setDoneSubmitting] = useState(false);

  const resetCreateSalonForm = useCallback(() => {
    setPendingOrgPhotoFile(null);
    setNewOrgName("");
    setNewOrgAddrQ("");
    setNewOrgPlacePicked(null);
    setOrgAddressMapOpen(false);
    setNewOrgPhone("");
    setNewOrgEmail("");
    setNewOrgWebsite("");
    setNewOrgDescription("");
    setNewOrgYears("");
    setNewOrgCategoryIds(new Set());
  }, []);

  useEffect(() => {
    if (!spec) {
      return;
    }
    setPName((prev) => (prev ? prev : spec.userName ?? ""));
    setPPhoneLocal((prev) => (prev ? prev : parseVnLocalForInput(spec.userPhone)));
    setPBio((prev) => (prev ? prev : spec.bio?.trim() ?? ""));
    setPExp((prev) => (prev ?? yearsToKey(spec.experienceYears)));
    const m = spec.massage;
    if (m?.pressureLevel) {
      setStrength(m.pressureLevel);
    }
    if (m?.pressureAdaptsToClient != null) {
      setAdapt(!!m.pressureAdaptsToClient);
    }
  }, [spec]);

  useEffect(() => {
    if (!pendingPhotoFile) {
      setPendingPhotoObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingPhotoFile);
    setPendingPhotoObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pendingPhotoFile]);

  useEffect(() => {
    if (!pendingOrgPhotoFile) {
      setPendingOrgPhotoObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingOrgPhotoFile);
    setPendingOrgPhotoObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pendingOrgPhotoFile]);

  useEffect(() => {
    let c = false;
    (async () => {
      const { data, error } = await catalogGetCategoriesByMajorSlug({
        client: sdk,
        path: { majorSlug: CATALOG_MAJOR_CATEGORY_SLUG },
        query: { locale, listedInDirectory: true },
      });
      if (c) {
        return;
      }
      if (error || !data?.categories?.length) {
        return;
      }
      const list = data.categories.map((x) => ({
        id: x.id,
        slug: x.slug,
        label: x.shortName,
      }));
      setCategories(list);
      setServices((prev) =>
        prev.length > 0
          ? prev
          : [defaultSvc(data.categories[0]!.id)],
      );
    })();
    return () => {
      c = true;
    };
  }, [locale, sdk]);

  const firstCat = categories[0]?.id ?? "";
  const maxUi = maxUiStepAllowed(
    (apiStep as 1 | 3 | 4 | 5 | 6) ?? 1,
  );

  const activeUi = useMemo(() => {
    const fallback = defaultWizardStepForApiStep(apiStep);
    const fromUrl = qStep ? clampUi(parseInt(qStep, 10)) : fallback;
    return Math.min(fromUrl, maxUi);
  }, [qStep, maxUi, apiStep]);

  useEffect(() => {
    if (isSpecialistOnboardingComplete(onboard ?? null)) {
      router.replace("/business");
    }
  }, [onboard, router]);

  /**
   * После мутации обязателен `serverOnboardingStep` с ответа `refetch()` — иначе `maxUi` из
   * прошлого рендера даёт `min(3,2)=2` и пользователь остаётся на том же экране (двойной клик).
   */
  const setStep = useCallback(
    (n: number, serverOnboardingStep?: number) => {
      const cap =
        serverOnboardingStep != null
          ? maxUiStepAllowed(
              (serverOnboardingStep as 1 | 3 | 4 | 5 | 6) ?? 1,
            )
          : maxUi;
      const s = Math.min(clampUi(n), cap);
      const qs = new URLSearchParams();
      qs.set("step", String(s));
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
      setFormError(null);
    },
    [maxUi, pathname, router],
  );

  const onIntroContinue = async () => {
    setFormError(null);
    setIntroSubmitting(true);
    try {
      const { error } = await usersPostEnsureSpecialist({ client: sdk });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      const { data: fresh } = await refetch();
      const stepAfter = (fresh?.onboardingStep ?? 1) as number;
      if (stepAfter === 1) {
        setStep(2, stepAfter);
      } else if (stepAfter === 3) {
        setStep(3, stepAfter);
      } else if (stepAfter === 4) {
        setStep(4, stepAfter);
      } else if (stepAfter === 5) {
        setStep(5, stepAfter);
      } else {
        setStep(2, stepAfter);
      }
    } finally {
      setIntroSubmitting(false);
    }
  };

  const onProfileContinue = async () => {
    if (!pName.trim() || !pBio.trim() || pExp == null) {
      setFormError(t("vErrName"));
      return;
    }
    if (!isPlausibleVnNational(pPhoneLocal)) {
      setFormError(t("vErrPhone"));
      return;
    }
    setFormError(null);
    setProfileSaving(true);
    let imageUrl: string | undefined;
    if (pendingPhotoFile) {
      const up = await filesUploadPublic({
        client: sdk,
        body: { file: pendingPhotoFile },
      });
      if (up.error || !up.data?.url) {
        setFormError(t("vErrPhoto"));
        setProfileSaving(false);
        return;
      }
      imageUrl = up.data.url;
    }
    try {
      const { error } = await usersPatchSpecialistOnboardingProfile({
        client: sdk,
        body: {
          name: pName.trim(),
          phone: toE164Vietnam(pPhoneLocal),
          bio: pBio.trim(),
          experienceYears: keyToYears(pExp),
          ...(imageUrl != null ? { imageUrl } : {}),
        },
      });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      setPendingPhotoFile(null);
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      const { data: o2 } = await refetch();
      if (o2 && (o2.onboardingStep as number) < 3) {
        setFormError(t("vErrName"));
        return;
      }
      setStep(3, o2?.onboardingStep);
    } finally {
      setProfileSaving(false);
    }
  };

  const validateServices = () => {
    if (services.length === 0) {
      return false;
    }
    for (const s of services) {
      if (!s.categoryId || s.durationPrices.length === 0) {
        return false;
      }
      for (const d of s.durationPrices) {
        if (
          !Number.isInteger(d.minutes) ||
          d.minutes < DURATION_MINUTES_MIN ||
          d.minutes > DURATION_MINUTES_MAX
        ) {
          return false;
        }
        const digits = String(d.priceVnd).replace(/\D/g, "");
        const n = digits.length > 0 ? Number(digits) : Number.NaN;
        if (!Number.isFinite(n) || n < 1) {
          return false;
        }
      }
    }
    return true;
  };

  const onServicesContinue = async () => {
    if (!validateServices()) {
      setFormError(t("vErrService"));
      return;
    }
    setFormError(null);
    setServicesSubmitting(true);
    try {
      const p1 = await usersPatchSpecialistOnboardingProfile({
        client: sdk,
        body: {
          massage: {
            pressureLevel: strength,
            pressureAdaptsToClient: adapt,
          },
        },
      });
      if (p1.error) {
        setFormError(t("vErrService"));
        return;
      }
      for (const s of services) {
        const priceOptions = s.durationPrices.map((d) => ({
          durationMinutes: d.minutes,
          priceAmount: Math.round(
            Number(String(d.priceVnd).replace(/\D/g, "")),
          ),
        }));
        const { error } = await usersPostSpecialistPersonalService({
          client: sdk,
          query: { locale },
          body: {
            categoryId: s.categoryId,
            priceOptions: priceOptions.map((o) => ({ ...o, currency: "VND" })),
          },
        });
        if (error) {
          setFormError(t("vErrService"));
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      const { data: o2 } = await refetch();
      setStep(4, o2?.onboardingStep);
    } finally {
      setServicesSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeUi === 4) {
      setOrgSuggestOpen(true);
    }
  }, [activeUi]);

  useEffect(() => {
    if (activeUi !== 4) {
      return;
    }
    const q = orgQ.trim();
    if (q.length < 2) {
      setOrgHits([]);
      return;
    }
    setOrgPending(true);
    const tmr = setTimeout(() => {
      (async () => {
        const { data, error } = await organizationsList({
          client: sdk,
          query: {
            q,
            majorSlug: CATALOG_MAJOR_CATEGORY_SLUG,
            limit: 8,
            locale,
          },
        });
        setOrgPending(false);
        if (error || !data?.organizations) {
          setOrgHits([]);
          return;
        }
        setOrgHits(
          data.organizations.map((o) => ({
            id: o.id,
            name: o.name,
            addressLine: o.addressLine,
            city: o.city,
          })),
        );
      })();
    }, 300);
    return () => {
      clearTimeout(tmr);
    };
  }, [activeUi, orgQ, locale, sdk]);

  const onOrgContinue = async () => {
    if (!orgPicked) {
      setFormError(t("vErrOrg"));
      return;
    }
    setFormError(null);
    setWorkplaceSubmitting(true);
    try {
      const res = await usersPostJoinOnboardingOrganization({
        client: sdk,
        body: { organizationId: orgPicked },
      });
      if (res.error) {
        const st = res.response?.status;
        setFormError(st === 409 ? t("vErrOrgJoinConflict") : t("vErrOrg"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      const { data: o2 } = await refetch();
      setStep(5, o2?.onboardingStep);
    } finally {
      setWorkplaceSubmitting(false);
    }
  };

  const onCreateSalonSubmit = async () => {
    if (!newOrgName.trim() || newOrgPlacePicked == null) {
      setFormError(t("vErrCreateOrgRequired"));
      return;
    }
    let placeRef: { provider: string; placeId: string };
    try {
      const parsed = JSON.parse(newOrgPlacePicked) as { p: string; i: string };
      if (typeof parsed.p !== "string" || typeof parsed.i !== "string" || !parsed.p || !parsed.i) {
        setFormError(t("vErrCreateOrgRequired"));
        return;
      }
      placeRef = { provider: parsed.p, placeId: parsed.i };
    } catch {
      setFormError(t("vErrCreateOrgRequired"));
      return;
    }
    if (newOrgCategoryIds.size < 1) {
      setFormError(t("vErrCreateOrgCategories"));
      return;
    }
    setFormError(null);
    setCreateOrgSubmitting(true);
    let imageUrl: string | undefined;
    if (pendingOrgPhotoFile) {
      const up = await filesUploadPublic({
        client: sdk,
        body: { file: pendingOrgPhotoFile },
      });
      if (up.error || !up.data?.url) {
        setFormError(t("vErrPhoto"));
        setCreateOrgSubmitting(false);
        return;
      }
      imageUrl = up.data.url;
    }
    const yearsRaw = newOrgYears.trim();
    const yearsParsed =
      yearsRaw === ""
        ? null
        : Math.min(80, Math.max(0, parseInt(yearsRaw, 10) || 0));
    try {
      const { error } = await usersPostCreateOnboardingOrganization({
        client: sdk,
        query: { locale },
        body: {
          name: newOrgName.trim(),
          placeReference: {
            provider: placeRef.provider as
              | "locationiq"
              | "geoapify"
              | "opencage"
              | "nominatim",
            placeId: placeRef.placeId,
          },
          description: newOrgDescription.trim() || undefined,
          phone: newOrgPhone.trim() || null,
          email: newOrgEmail.trim() || null,
          website: newOrgWebsite.trim() || null,
          yearsInBusiness: yearsParsed,
          imageUrl: imageUrl ?? null,
          imageAlt: imageUrl != null ? newOrgName.trim() : null,
          serviceCategoryIds: Array.from(newOrgCategoryIds),
        },
      });
      if (error) {
        setFormError(t("vErrCreateOrg"));
        return;
      }
      resetCreateSalonForm();
      setCreateSalonOpen(false);
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      const { data: o2 } = await refetch();
      setStep(5, o2?.onboardingStep);
    } finally {
      setCreateOrgSubmitting(false);
    }
  };

  const onWorkplaceSkip = () => {
    setFormError(null);
    router.replace("/business");
  };

  const onDone = async () => {
    setFormError(null);
    setDoneSubmitting(true);
    try {
      const { error } = await usersPostSpecialistOnboardingComplete({ client: sdk });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      router.replace("/business");
    } finally {
      setDoneSubmitting(false);
    }
  };

  useLayoutEffect(() => {
    if (sessionStatus === "unauthenticated" || !accessToken) {
      return;
    }
    if (isLoading || !onboard) {
      return;
    }
    const top = topChromeRef.current;
    const bottom = bottomChromeRef.current;
    if (!top || !bottom) {
      return;
    }
    const measure = () => {
      setTopChromeHeightPx(top.getBoundingClientRect().height);
      setBottomChromeHeightPx(bottom.getBoundingClientRect().height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(top);
    ro.observe(bottom);
    return () => {
      ro.disconnect();
    };
  }, [
    accessToken,
    activeUi,
    formError,
    isLoading,
    onboard,
    sessionStatus,
  ]);

  /** Пока сессия не готова, `accessToken` пуст — нельзя путать с «не вошли» (иначе кратко виден vErrName). */
  if (
    sessionStatus === "loading" ||
    (sessionStatus === "authenticated" && accessToken.length === 0)
  ) {
    return (
      <div
        className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  if (sessionStatus === "unauthenticated" || accessToken.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("vErrName")}
      </p>
    );
  }

  if (isLoading || !onboard) {
    return (
      <div
        className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  const specialistImagePath =
    spec?.imageUrl != null && String(spec.imageUrl).length > 0
      ? String(spec.imageUrl)
      : null;
  const photoPreviewUrl =
    pendingPhotoObjectUrl ??
    (specialistImagePath ? resolveApiResourceUrl(specialistImagePath) : null);
  const photoFileLabel = pendingPhotoFile
    ? pendingPhotoFile.name
    : specialistImagePath
      ? t("currentSpecialistPhoto")
      : null;

  const addService = () => {
    setServices((prev) => [...prev, defaultSvc(firstCat || prev[0]?.categoryId || "")]);
  };
  const removeService = (i: number) => {
    setServices((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
    setServicePanelOpen({});
  };
  const updateSvc = (i: number, p: SvcForm) => {
    setServices((prev) => prev.map((s, j) => (j === i ? p : s)));
  };

  const isServicePanelOpen = (si: number) => servicePanelOpen[si] !== false;

  return (
    <div className="relative flex h-full min-h-0 w-full max-w-md flex-1 flex-col">
      <div
        ref={topChromeRef}
        className="fixed left-0 right-0 top-0 z-50 border-b border-border/40 bg-surface-light/95 pt-[max(0.5rem,env(safe-area-inset-top,0px))] backdrop-blur-sm supports-[backdrop-filter]:bg-surface-light/90"
      >
        <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-3">
          <BusinessScreenHeader
            title={tSetup("title")}
            titleVariant="section"
            showHeadline={false}
            avatarAlt={tSetup("title")}
            avatarFallback="S"
          />
          <OnboardingStepper
            current={activeUi}
            total={5}
            aria={t("stepperAria")}
          />
          {formError ? (
            <p className="text-pretty text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto [scrollbar-gutter:stable] px-4"
        style={{
          paddingTop: topChromeHeightPx + 8 + 16,
          paddingBottom: bottomChromeHeightPx + 4 + 16,
        }}
      >
        {activeUi === 1 && (
          <section className="space-y-3">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {t("step1Title")}
            </h1>
            <p className="text-pretty text-[0.9375rem] text-muted-foreground">
              {t("step1Sub")}
            </p>
          </section>
        )}

      {activeUi === 2 && (
        <section className="space-y-3">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {t("step2Title")}
          </h1>
          <p className="text-pretty text-[0.9375rem] text-muted-foreground">
            {t("step2Sub")}
          </p>
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("photoLabel")}</span>
            <AvatarPhotoDropzone
              disabled={profileSaving}
              title={t("uploadPhoto")}
              hint={t("uploadHint")}
              dropzoneAriaLabel={
                photoPreviewUrl ? t("changePhoto") : t("uploadPhoto")
              }
              previewUrl={photoPreviewUrl}
              fileLabel={photoFileLabel}
              titleWithPreview={t("changePhoto")}
              hintWithPreview={t("photoReplaceHint")}
              onFileChosen={(file) => setPendingPhotoFile(file)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("fieldName")}</span>
            <Input
              className="rounded-full border-0 bg-muted/50"
              value={pName}
              disabled={profileSaving}
              onChange={(e) => setPName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("fieldPhone")}</span>
            <p className="text-xs text-muted-foreground">{t("fieldPhoneVnOnly")}</p>
            <InputGroup
              className="h-12 min-h-12 w-full items-stretch rounded-full border-0 bg-muted/50 pl-0.5 has-disabled:opacity-60"
              aria-label={t("fieldPhoneGroupAria")}
            >
              <InputGroupAddon
                align="inline-start"
                className="shrink-0 border-r border-border/50 pr-2 pl-3"
              >
                <InputGroupText className="text-foreground tabular-nums">
                  +84
                </InputGroupText>
                <span className="text-xs text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  VN
                </span>
              </InputGroupAddon>
              <InputGroupInput
                className="h-12 min-w-0 text-base"
                value={pPhoneLocal}
                disabled={profileSaving}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setPPhoneLocal(next);
                }}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={t("phoneLocalPlaceholder")}
              />
            </InputGroup>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("fieldBio")}</span>
            <textarea
              className="w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              rows={4}
              value={pBio}
              disabled={profileSaving}
              onChange={(e) => setPBio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("fieldExp")}</span>
            <div className="flex flex-wrap gap-2">
              {EXP_ORDER.map((k) => {
                const labelKey =
                  k === "0-1" ? "exp_0_1" : k === "1-3" ? "exp_1_3" : k === "3-5" ? "exp_3_5" : "exp_5p";
                const selected = pExp === k;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={profileSaving}
                    onClick={() => setPExp(k)}
                    className={cn(
                      "touch-target rounded-full border px-3.5 py-2 text-sm disabled:opacity-50",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-muted/30",
                    )}
                  >
                    {t(labelKey as "exp_0_1")}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeUi === 3 && firstCat && (
        <section className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-background/80 to-amber-500/[0.08] p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1.5">
                <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground">
                  {t("step3Title")}
                </h1>
                <p className="text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {t("step3Sub")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-muted/20 p-4 ring-1 ring-inset ring-border/40">
            <span className="text-sm font-medium text-foreground">{t("strengthLabel")}</span>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="max-w-[40%] leading-snug">{t("strengthLeft")}</span>
              <span className="max-w-[40%] text-right leading-snug">{t("strengthRight")}</span>
            </div>
            <div
              className={cn(
                "flex gap-1.5 transition-opacity",
                adapt && "opacity-45",
              )}
              role="group"
              aria-label={t("strengthLabel")}
            >
              {[1, 2, 3, 4, 5].map((d) => {
                const on = d <= strength;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setStrength(d)}
                    disabled={servicesSubmitting || adapt}
                    className={cn(
                      "box-border flex h-12 min-h-12 flex-1 min-w-0 touch-target items-center justify-center rounded-xl border-2 text-sm font-semibold tabular-nums transition-colors duration-150 disabled:opacity-50",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background/90 text-foreground/55 hover:border-primary/30 hover:bg-muted/40",
                    )}
                    aria-pressed={on}
                    aria-label={`${d} / 5`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <label
              className={cn(
                "mt-1 flex cursor-pointer items-start gap-3 border-t border-border/30 pt-3",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-primary/30",
              )}
            >
              <Checkbox
                className="mt-0.5"
                disabled={servicesSubmitting}
                checked={adapt}
                onCheckedChange={(c) => setAdapt(c === true)}
              />
              <span className="text-pretty text-sm leading-snug text-foreground">
                {t("adaptCheck")}
              </span>
            </label>
          </div>

          {services.map((s, si) => {
            const open = isServicePanelOpen(si);
            return (
              <Collapsible
                key={si}
                open={open}
                onOpenChange={(next) =>
                  setServicePanelOpen((prev) => ({ ...prev, [si]: next }))
                }
                className="overflow-hidden rounded-3xl border border-border/40 bg-card/60 ring-1 ring-border/30"
              >
                <CollapsibleTrigger
                  className="flex w-full touch-manipulation items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                  id={`service-panel-heading-${si}`}
                >
                  <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                    {t("serviceBlockTitle", { index: si + 1 })}
                  </h2>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent
                  id={`service-panel-body-${si}`}
                  role="region"
                  aria-labelledby={`service-panel-heading-${si}`}
                >
                  <div className="transform-gpu space-y-4 border-t border-border/30 p-4">
                    <div className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">{t("categoryLabel")}</span>
                    <Select
                      value={s.categoryId}
                      disabled={servicesSubmitting}
                      onValueChange={(v) => updateSvc(si, { ...s, categoryId: v })}
                    >
                      <SelectTrigger className="h-12 w-full min-w-0 rounded-2xl border-0 bg-muted/45">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("addDurationHint")}
                  </p>
                  <div className="space-y-2">
                    {s.durationPrices.map((dp, di) => (
                      <div
                        key={`${si}-${di}`}
                        className="grid min-w-0 grid-cols-[minmax(0,5.25rem)_1fr_2.75rem] items-stretch gap-2 rounded-2xl bg-muted/20 p-3 ring-1 ring-inset ring-border/25"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("duration")}
                          </span>
                          <Input
                            type="number"
                            min={DURATION_MINUTES_MIN}
                            max={DURATION_MINUTES_MAX}
                            className="h-11 rounded-xl border-0 bg-background/80"
                            disabled={servicesSubmitting}
                            value={dp.minutes > 0 ? String(dp.minutes) : ""}
                            onChange={(e) => {
                              const nextD = [...s.durationPrices];
                              const raw = e.target.value;
                              if (raw === "") {
                                nextD[di] = { ...nextD[di]!, minutes: 0 };
                                updateSvc(si, { ...s, durationPrices: nextD });
                                return;
                              }
                              const m = parseInt(raw, 10);
                              if (Number.isNaN(m) || m < 0) {
                                return;
                              }
                              nextD[di] = { ...nextD[di]!, minutes: m };
                              updateSvc(si, { ...s, durationPrices: nextD });
                            }}
                          />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("priceVnd")}
                          </span>
                          <Input
                            type="text"
                            className="h-11 min-w-0 rounded-xl border-0 bg-background/80"
                            value={formatVndPriceForInput(dp.priceVnd)}
                            disabled={servicesSubmitting}
                            onChange={(e) => {
                              const digitsOnly = digitsFromVndPriceInput(e.target.value);
                              const nextD = [...s.durationPrices];
                              nextD[di] = { ...nextD[di]!, priceVnd: digitsOnly };
                              updateSvc(si, { ...s, durationPrices: nextD });
                            }}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="—"
                          />
                        </div>
                        <div className="flex min-h-0 min-w-0 items-end justify-end self-stretch">
                          {di > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11 w-11 shrink-0 rounded-xl border-0 bg-muted/45 p-0 text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35"
                              disabled={servicesSubmitting}
                              aria-label={t("removeDuration")}
                              onClick={() => {
                                const nextD = s.durationPrices.filter((_, j) => j !== di);
                                if (nextD.length < 1) {
                                  return;
                                }
                                updateSvc(si, { ...s, durationPrices: nextD });
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-muted/45 px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/35 sm:w-auto"
                    disabled={servicesSubmitting}
                    onClick={() => {
                      const next = [
                        ...s.durationPrices,
                        {
                          minutes: nextMinutesWhenAddingDuration(s.durationPrices),
                          priceVnd: "",
                        },
                      ];
                      updateSvc(si, { ...s, durationPrices: next });
                    }}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    {t("addDuration")}
                  </Button>
                  {services.length > 1 ? (
                    <>
                      <Separator className="bg-border/50" />
                      <div className="pt-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-full py-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={servicesSubmitting}
                          onClick={() => removeService(si)}
                        >
                          {t("removeService")}
                        </Button>
                      </div>
                    </>
                  ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          <Button
            type="button"
            variant="primary"
            className="h-12 w-full gap-2 rounded-2xl border-2 border-primary !bg-transparent text-primary shadow-none hover:!bg-transparent hover:border-primary hover:text-primary active:!bg-transparent active:opacity-90"
            onClick={addService}
            disabled={servicesSubmitting}
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            {t("addService")}
          </Button>
        </section>
      )}

      {activeUi === 4 && (
        <section className="space-y-3">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {t("step4Title")}
          </h1>
          <p className="text-pretty text-[0.9375rem] text-muted-foreground">
            {t("step4Sub")}
          </p>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground" id="org-search-label">
              {t("searchOrg")}
            </span>
            <SearchAutocomplete
              value={orgQ}
              onValueChange={(v) => {
                setOrgQ(v);
                setOrgPicked(null);
                setOrgSuggestOpen(true);
              }}
              onSelect={(item) => {
                setOrgPicked(item.id);
                setOrgQ(item.name);
                setOrgSuggestOpen(false);
              }}
              items={orgHits}
              isLoading={orgPending}
              selectedId={orgPicked}
              listOpen={orgSuggestOpen}
              onListOpenChange={setOrgSuggestOpen}
              minQueryLength={2}
              inputId="org-workplace-combobox"
              listboxId="org-workplace-listbox"
              inputLabelledBy="org-search-label"
              placeholder={t("searchPlaceholder")}
              listAriaLabel={t("searchOrg")}
              loadingText={t("orgSearchLoading")}
              emptyText={t("orgSearchEmpty")}
              disabled={workplaceSubmitting || createOrgSubmitting}
            />
          </div>
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-2xl border-0 bg-muted/45 px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80"
              disabled={
                workplaceSubmitting || createOrgSubmitting || categories.length < 1
              }
              onClick={() => {
                setFormError(null);
                if (newOrgCategoryIds.size === 0 && categories[0]) {
                  setNewOrgCategoryIds(new Set([categories[0]!.id]));
                }
                setCreateSalonOpen(true);
              }}
            >
              {t("addOrgCta")}
            </Button>
          </div>
          {createSalonOpen ? (
            <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {t("orgFormTitle")}
              </h2>
              <p className="text-pretty text-sm text-muted-foreground">{t("orgFormHint")}</p>
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">{t("orgPhoto")}</span>
                <AvatarPhotoDropzone
                  disabled={createOrgSubmitting}
                  title={t("uploadPhoto")}
                  hint={t("uploadHint")}
                  dropzoneAriaLabel={t("orgPhoto")}
                  previewUrl={pendingOrgPhotoObjectUrl}
                  fileLabel={pendingOrgPhotoFile?.name ?? null}
                  titleWithPreview={t("changePhoto")}
                  hintWithPreview={t("photoReplaceHint")}
                  onFileChosen={(file) => setPendingOrgPhotoFile(file)}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t("orgName")}</span>
                <Input
                  className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
                  value={newOrgName}
                  disabled={createOrgSubmitting}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <span
                  className="text-sm font-medium text-foreground"
                  id="new-org-address-label"
                >
                  {t("orgAddress")}
                </span>
                <p className="text-pretty text-xs text-muted-foreground">
                  {t("orgFormAddressMapHint")}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full gap-2 rounded-2xl border-0 shadow-none"
                  disabled={createOrgSubmitting}
                  aria-labelledby="new-org-address-label"
                  onClick={() => {
                    setFormError(null);
                    setOrgAddressMapNonce((n) => n + 1);
                    setOrgAddressMapOpen(true);
                  }}
                >
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  {t("orgFormPickOnMap")}
                </Button>
                {newOrgAddrQ.trim().length > 0 ? (
                  <div className="rounded-2xl bg-muted/25 px-3 py-2.5 ring-1 ring-inset ring-border/30">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("orgFormAddressSelected")}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{newOrgAddrQ}</p>
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t("orgFormPhone")}</span>
                <Input
                  className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
                  value={newOrgPhone}
                  disabled={createOrgSubmitting}
                  onChange={(e) => setNewOrgPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t("orgFormEmail")}</span>
                <Input
                  className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
                  value={newOrgEmail}
                  disabled={createOrgSubmitting}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t("orgFormWebsite")}</span>
                <Input
                  className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
                  value={newOrgWebsite}
                  disabled={createOrgSubmitting}
                  onChange={(e) => setNewOrgWebsite(e.target.value)}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t("orgFormYears")}</span>
                <Input
                  className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
                  value={newOrgYears}
                  disabled={createOrgSubmitting}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setNewOrgYears(v);
                  }}
                  inputMode="numeric"
                  placeholder="0–80"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{t("orgFormDescription")}</span>
                <textarea
                  className="w-full min-h-20 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  rows={3}
                  value={newOrgDescription}
                  disabled={createOrgSubmitting}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">{t("orgFormCategories")}</span>
                <div className="flex flex-col gap-2">
                  {categories.map((c) => {
                    const checked = newOrgCategoryIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={createOrgSubmitting}
                          onCheckedChange={() => {
                            setNewOrgCategoryIds((prev) => {
                              const n = new Set(prev);
                              if (n.has(c.id)) {
                                n.delete(c.id);
                              } else {
                                n.add(c.id);
                              }
                              return n;
                            });
                          }}
                        />
                        <span className="text-sm">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full rounded-full sm:w-auto"
                  disabled={createOrgSubmitting}
                  onClick={() => {
                    setFormError(null);
                    resetCreateSalonForm();
                    setCreateSalonOpen(false);
                  }}
                >
                  {t("createSalonClose")}
                </Button>
                <Button
                  type="button"
                  className="h-12 w-full rounded-full sm:min-w-40"
                  disabled={createOrgSubmitting}
                  onClick={() => {
                    void onCreateSalonSubmit();
                  }}
                >
                  {createOrgSubmitting ? t("saving") : t("createSalonSubmit")}
                </Button>
              </div>
            </div>
          ) : null}
          {createSalonOpen ? (
            <AddressMapPickerDialog
              key={orgAddressMapNonce}
              open={orgAddressMapOpen}
              onOpenChange={setOrgAddressMapOpen}
              client={sdk}
              locale={locale}
              onPick={(r) => {
                setNewOrgAddrQ(r.addressLine);
                setNewOrgPlacePicked(
                  JSON.stringify({ p: r.sourceProvider, i: r.sourceReference }),
                );
              }}
            />
          ) : null}
        </section>
      )}

        {activeUi === 5 && (
          <section className="space-y-3">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {t("step5Title")}
            </h1>
            <p className="text-pretty text-[0.9375rem] text-muted-foreground">
              {spec?.pendingWorkplaceJoinRequest &&
              !spec.activeOrganizationId ? (
                <span>
                  {t("step5SubPendingWorkplace", {
                    name: spec.pendingWorkplaceJoinRequest.organizationName,
                  })}
                </span>
              ) : (
                t("step5Sub")
              )}
            </p>
          </section>
        )}
      </div>

      <div
        ref={bottomChromeRef}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-surface-light/95 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm supports-[backdrop-filter]:bg-surface-light/90"
      >
        <div className="mx-auto w-full max-w-lg space-y-2 px-4">
        {activeUi === 1 ? (
          <Button
            type="button"
            className="h-12 w-full rounded-full"
            onClick={onIntroContinue}
            disabled={introSubmitting}
          >
            {introSubmitting ? t("saving") : t("continue")}
          </Button>
        ) : null}
        {activeUi === 2 ? (
          <Button
            type="button"
            className="h-12 w-full rounded-full"
            onClick={onProfileContinue}
            disabled={profileSaving}
          >
            {profileSaving ? t("saving") : t("continue")}
          </Button>
        ) : null}
        {activeUi === 3 && firstCat ? (
          <Button
            type="button"
            className="h-12 w-full rounded-full"
            onClick={onServicesContinue}
            disabled={servicesSubmitting}
          >
            {servicesSubmitting ? t("saving") : t("continue")}
          </Button>
        ) : null}
        {activeUi === 4 ? (
          <>
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              onClick={onOrgContinue}
              disabled={
                workplaceSubmitting || createOrgSubmitting || createSalonOpen
              }
            >
              {workplaceSubmitting ? t("saving") : t("workplaceRequestSubmit")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-full"
              onClick={onWorkplaceSkip}
              disabled={createOrgSubmitting}
            >
              {t("skip")}
            </Button>
          </>
        ) : null}
        {activeUi === 5 ? (
          <Button
            type="button"
            className="h-12 w-full rounded-full"
            onClick={onDone}
            disabled={doneSubmitting}
          >
            {doneSubmitting ? t("saving") : t("goDashboard")}
          </Button>
        ) : null}
        </div>
      </div>
    </div>
  );
}
