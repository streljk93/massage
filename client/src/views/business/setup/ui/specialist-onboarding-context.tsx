/* eslint-disable react-hooks/set-state-in-effect -- синхронизация полей с ответом API и debounce поиска организаций */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  defaultWizardStepForApiStep,
  isSpecialistOnboardingComplete,
  maxUiStepAllowed,
} from "@/entities/business";
import type { SpecialistsCabinetGetSpecialistOnboardingResponse } from "@/shared/api/generated/sdk/types.gen";
import {
  createBrowserSdkClient,
  filesUploadPublic,
  organizationsCabinetGetWorkplaceOrganizationSearch,
  organizationsCabinetPostCreateOrganization,
  organizationsCabinetPostRequestWorkplaceJoin,
  specialistsCabinetGetSpecialistOnboarding,
  specialistsCabinetPatchSpecialistProfile,
  specialistsCabinetPostEnsureSpecialist,
  specialistsCabinetPostSpecialistOnboardingComplete,
  specialistsCabinetPostSpecialistPersonalService,
} from "@/shared/api";
import type { OrganizationSalonCabinetSubmitBody } from "@/entities/organizations";
import { resolveApiResourceUrl } from "@/shared/lib/resolve-api-resource-url";
import type { ExperienceKey } from "../lib/specialist-onboarding-utils";
import {
  clampUi,
  defaultSvc,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  isPlausibleVnNational,
  keyToYears,
  parseVnLocalForInput,
  toE164Vietnam,
  yearsToKey,
  type SvcForm,
} from "../lib/specialist-onboarding-utils";

export const ONB_QK = ["specialistOnboarding"] as const;

export type SpecialistOnboardingSpec = {
  bio?: string | null;
  experienceYears?: number | null;
  imageUrl?: string | null;
  /** Имя мастера на витрине (каталог). */
  listingName?: string | null;
  /** Личное имя аккаунта (`User.name`). */
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
};

export type SpecialistOnboardingContextValue = {
  sessionLoading: boolean;
  unauthenticated: boolean;
  onboardingLoading: boolean;
  ready: boolean;
  activeUi: number;
  apiStep: number;
  spec: SpecialistOnboardingSpec | null | undefined;
  onboard: SpecialistsCabinetGetSpecialistOnboardingResponse | undefined;

  locale: AppLocale;
  sdk: ReturnType<typeof createBrowserSdkClient>;
  accessToken: string;
  formError: string | null;
  setFormError: (v: string | null) => void;

  pName: string;
  setPName: (v: string) => void;
  pPhoneLocal: string;
  setPPhoneLocal: (v: string) => void;
  pBio: string;
  setPBio: (v: string) => void;
  pendingPhotoFile: File | null;
  setPendingPhotoFile: (v: File | null) => void;
  profileSaving: boolean;
  pExp: ExperienceKey | null;
  setPExp: (v: ExperienceKey | null) => void;
  strength: number;
  setStrength: (v: number) => void;
  adapt: boolean;
  setAdapt: (v: boolean) => void;
  services: SvcForm[];
  setServices: Dispatch<SetStateAction<SvcForm[]>>;
  servicePanelOpen: Record<number, boolean>;
  setServicePanelOpen: Dispatch<SetStateAction<Record<number, boolean>>>;

  orgQ: string;
  setOrgQ: (v: string) => void;
  orgHits: Array<{
    id: string;
    name: string;
    addressLine: string | null;
    city?: string | null;
  }>;
  orgPicked: string | null;
  setOrgPicked: (v: string | null) => void;
  orgSuggestOpen: boolean;
  setOrgSuggestOpen: (v: boolean) => void;
  orgPending: boolean;
  createSalonOpen: boolean;
  setCreateSalonOpen: (v: boolean) => void;
  createOrgSubmitting: boolean;
  workplaceSubmitting: boolean;
  introSubmitting: boolean;
  servicesSubmitting: boolean;
  doneSubmitting: boolean;

  photoPreviewUrl: string | null;
  photoFileLabel: string | null;

  queryClient: ReturnType<typeof useQueryClient>;
  refetch: () => Promise<unknown>;

  setStep: (n: number, serverOnboardingStep?: number) => void;
  onIntroContinue: () => Promise<void>;
  onProfileContinue: () => Promise<void>;
  onServicesContinue: () => Promise<void>;
  onOrgContinue: () => Promise<void>;
  submitCreateOrganizationFromOnboarding: (
    body: OrganizationSalonCabinetSubmitBody,
  ) => Promise<void>;
  onWorkplaceSkip: () => void;
  onDone: () => Promise<void>;

  addService: () => void;
  removeService: (i: number) => void;
  updateSvc: (i: number, p: SvcForm) => void;
  isServicePanelOpen: (si: number) => boolean;
};

const SpecialistOnboardingContext =
  createContext<SpecialistOnboardingContextValue | null>(null);

export function SpecialistOnboardingProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const routeStepParam = params.step;
  const routeStepRaw = Array.isArray(routeStepParam)
    ? routeStepParam[0]
    : routeStepParam;

  const t = useTranslations("specialistOnboarding");
  const router = useRouter();
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
      const { data, error } = await specialistsCabinetGetSpecialistOnboarding({
        client: sdk,
        query: { locale },
      });
      if (error || !data) {
        throw new Error("onboarding");
      }
      return data;
    },
  });

  const apiStep = onboard?.onboardingStep ?? 1;
  const spec = onboard?.specialist as SpecialistOnboardingSpec | null | undefined;

  const [formError, setFormError] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pPhoneLocal, setPPhoneLocal] = useState("");
  const [pBio, setPBio] = useState("");
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoObjectUrl, setPendingPhotoObjectUrl] = useState<string | null>(
    null,
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [pExp, setPExp] = useState<ExperienceKey | null>(null);
  const [strength, setStrength] = useState(3);
  const [adapt, setAdapt] = useState(true);
  const [services, setServices] = useState<SvcForm[]>([]);
  const [servicePanelOpen, setServicePanelOpen] = useState<Record<number, boolean>>(
    {},
  );
  const [orgQ, setOrgQ] = useState("");
  const [orgHits, setOrgHits] = useState<
    Array<{ id: string; name: string; addressLine: string | null; city?: string | null }>
  >([]);
  const [orgPicked, setOrgPicked] = useState<string | null>(null);
  const [orgSuggestOpen, setOrgSuggestOpen] = useState(true);
  const [orgPending, setOrgPending] = useState(false);
  const [createSalonOpen, setCreateSalonOpen] = useState(false);
  const [createOrgSubmitting, setCreateOrgSubmitting] = useState(false);
  const [workplaceSubmitting, setWorkplaceSubmitting] = useState(false);
  const [introSubmitting, setIntroSubmitting] = useState(false);
  const [servicesSubmitting, setServicesSubmitting] = useState(false);
  const [doneSubmitting, setDoneSubmitting] = useState(false);

  useEffect(() => {
    if (!spec) {
      return;
    }
    setPName((prev) =>
      prev ? prev : (spec.listingName ?? spec.userName ?? "").trim() || "",
    );
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

  const maxUi = maxUiStepAllowed((apiStep as 1 | 3 | 4 | 5 | 6) ?? 1);

  const activeUi = useMemo(() => {
    const parsed = parseInt(String(routeStepRaw ?? ""), 10);
    const fromUrl = Number.isFinite(parsed)
      ? clampUi(parsed)
      : defaultWizardStepForApiStep(apiStep);
    return Math.min(fromUrl, maxUi);
  }, [routeStepRaw, maxUi, apiStep]);

  useEffect(() => {
    if (isSpecialistOnboardingComplete(onboard ?? null)) {
      router.replace("/business");
    }
  }, [onboard, router]);

  useEffect(() => {
    if (isLoading || !onboard) {
      return;
    }
    const raw = String(routeStepRaw ?? "");
    if (raw !== String(activeUi)) {
      router.replace(`/business/setup/${activeUi}`, { scroll: false });
    }
  }, [isLoading, onboard, routeStepRaw, activeUi, router]);

  const setStep = useCallback(
    (n: number, serverOnboardingStep?: number) => {
      const cap =
        serverOnboardingStep != null
          ? maxUiStepAllowed((serverOnboardingStep as 1 | 3 | 4 | 5 | 6) ?? 1)
          : maxUi;
      const s = Math.min(clampUi(n), cap);
      router.replace(`/business/setup/${s}`, { scroll: false });
      setFormError(null);
    },
    [maxUi, router],
  );

  const onIntroContinue = async () => {
    setFormError(null);
    setIntroSubmitting(true);
    try {
      const { error } = await specialistsCabinetPostEnsureSpecialist({
        client: sdk,
        query: { locale },
      });
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
      const { error } = await specialistsCabinetPatchSpecialistProfile({
        client: sdk,
        body: {
          name: pName.trim(),
          phone: toE164Vietnam(pPhoneLocal),
          bio: pBio.trim(),
          experienceYears: keyToYears(pExp),
          ...(imageUrl != null ? { imageUrl } : {}),
          massage: {
            pressureLevel: strength,
            pressureAdaptsToClient: adapt,
          },
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
      for (const s of services) {
        const priceOptions = s.durationPrices.map((d) => ({
          durationMinutes: d.minutes,
          priceAmount: Math.round(
            Number(String(d.priceVnd).replace(/\D/g, "")),
          ),
        }));
        const { error } = await specialistsCabinetPostSpecialistPersonalService({
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
    setOrgPending(true);
    const tmr = setTimeout(() => {
      void (async () => {
        const { data, error } = await organizationsCabinetGetWorkplaceOrganizationSearch({
          client: sdk,
          query: {
            ...(q ? { q } : {}),
            limit: 30,
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
      const res = await organizationsCabinetPostRequestWorkplaceJoin({
        client: sdk,
        path: { organizationId: orgPicked },
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

  const submitCreateOrganizationFromOnboarding = useCallback(
    async (body: OrganizationSalonCabinetSubmitBody) => {
      setFormError(null);
      setCreateOrgSubmitting(true);
      try {
        const { error } = await organizationsCabinetPostCreateOrganization({
          client: sdk,
          query: { locale },
          body,
        });
        if (error) {
          setFormError(t("vErrCreateOrg"));
          return;
        }
        setCreateSalonOpen(false);
        await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
        const { data: o2 } = await refetch();
        setStep(5, o2?.onboardingStep);
      } finally {
        setCreateOrgSubmitting(false);
      }
    },
    [accessToken, locale, queryClient, refetch, sdk, setStep, t],
  );

  const onWorkplaceSkip = () => {
    setFormError(null);
    router.replace("/business");
  };

  const onDone = async () => {
    setFormError(null);
    setDoneSubmitting(true);
    try {
      const { error } = await specialistsCabinetPostSpecialistOnboardingComplete({
        client: sdk,
      });
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

  const addService = () => {
    setServices((prev) => [
      ...prev,
      defaultSvc(prev[0]?.categoryId || ""),
    ]);
  };
  const removeService = (i: number) => {
    setServices((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
    setServicePanelOpen({});
  };
  const updateSvc = (i: number, p: SvcForm) => {
    setServices((prev) => prev.map((s, j) => (j === i ? p : s)));
  };
  const isServicePanelOpen = (si: number) => servicePanelOpen[si] !== false;

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

  const sessionLoading =
    sessionStatus === "loading" ||
    (sessionStatus === "authenticated" && accessToken.length === 0);
  const unauthenticated =
    sessionStatus === "unauthenticated" || accessToken.length === 0;
  const onboardingLoading = sessionStatus === "authenticated" && (isLoading || !onboard);
  const ready =
    sessionStatus === "authenticated" &&
    accessToken.length > 0 &&
    !isLoading &&
    !!onboard;

  const value: SpecialistOnboardingContextValue = {
    sessionLoading,
    unauthenticated,
    onboardingLoading,
    ready,
    activeUi,
    apiStep,
    spec,
    onboard,
    locale,
    sdk,
    accessToken,
    formError,
    setFormError,
    pName,
    setPName,
    pPhoneLocal,
    setPPhoneLocal,
    pBio,
    setPBio,
    pendingPhotoFile,
    setPendingPhotoFile,
    profileSaving,
    pExp,
    setPExp,
    strength,
    setStrength,
    adapt,
    setAdapt,
    services,
    setServices,
    servicePanelOpen,
    setServicePanelOpen,
    orgQ,
    setOrgQ,
    orgHits,
    orgPicked,
    setOrgPicked,
    orgSuggestOpen,
    setOrgSuggestOpen,
    orgPending,
    createSalonOpen,
    setCreateSalonOpen,
    createOrgSubmitting,
    workplaceSubmitting,
    introSubmitting,
    servicesSubmitting,
    doneSubmitting,
    photoPreviewUrl,
    photoFileLabel,
    queryClient,
    refetch: refetch as SpecialistOnboardingContextValue["refetch"],
    setStep,
    onIntroContinue,
    onProfileContinue,
    onServicesContinue,
    onOrgContinue,
    submitCreateOrganizationFromOnboarding,
    onWorkplaceSkip,
    onDone,
    addService,
    removeService,
    updateSvc,
    isServicePanelOpen,
  };

  return (
    <SpecialistOnboardingContext.Provider value={value}>
      {children}
    </SpecialistOnboardingContext.Provider>
  );
}

export function useSpecialistOnboarding(): SpecialistOnboardingContextValue {
  const ctx = useContext(SpecialistOnboardingContext);
  if (!ctx) {
    throw new Error("useSpecialistOnboarding must be used within SpecialistOnboardingProvider");
  }
  return ctx;
}
