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
  organizationsGetWorkplaceOrganizationSearch,
  organizationsCabinetPostCreateOrganization,
  organizationsCabinetPostRequestWorkplaceJoin,
  specialistsCabinetGetSpecialistOnboarding,
  specialistsCabinetPatchSpecialistOnboardingPreferences,
  specialistsCabinetPatchSpecialistProfile,
  specialistsCabinetPostEnsureSpecialist,
  specialistsCabinetPostSpecialistOnboardingComplete,
} from "@/shared/api";
import type { OrganizationSalonCabinetSubmitBody } from "@/entities/organizations";
import { resolveApiResourceUrl } from "@/shared/lib/resolve-api-resource-url";
import type { ExperienceKey } from "../lib/specialist-onboarding-utils";
import {
  clampUi,
  isPlausibleVnNational,
  keyToYears,
  parseVnLocalForInput,
  toE164Vietnam,
  yearsToKey,
} from "../lib/specialist-onboarding-utils";

export const ONB_QK = ["specialistOnboarding"] as const;

export type SpecialistWorkPatternUi = "solo" | "business" | "employed_salon";

export type SpecialistOnboardingSpec = {
  bio?: string | null;
  experienceYears?: number | null;
  imageUrl?: string | null;
  /** Имя мастера на витрине (каталог). */
  listingName?: string | null;
  gender?: "male" | "female" | null;
  /** Личное имя аккаунта (`User.name`). */
  userName?: string;
  userPhone?: string | null;
  massage?: {
    pressureLevel?: number | null;
    pressureAdaptsToClient?: boolean | null;
  } | null;
  activeOrganizationId?: string | null;
  /** Режим работы (онбординг). */
  onboardingWorkPattern?: SpecialistWorkPatternUi | null;
  /** Сферы онбординга до привязки к организации. */
  onboardingMajorCategorySlugs?: string[];
  /** При выбранном месте приёма — slug'и больших категорий организации; отсутствует, если место приёма не выбрано. */
  activeWorkplaceMajorCategorySlugs?: string[];
  pendingWorkplaceJoinRequest?: {
    id: string;
    organizationId: string;
    organizationName: string;
  } | null;
  /** Навыки (подкатегории каталога), без цены — `SpecialistServiceCategory`. */
  skillServiceCategoryIds?: string[];
  skillCategories?: Array<{ categoryId: string; name: string }>;
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
  pGender: "male" | "female" | null;
  setPGender: (v: "male" | "female" | null) => void;
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
  draftSkillCategoryIds: ReadonlySet<string>;
  setDraftSkillCategoryIds: Dispatch<SetStateAction<Set<string>>>;

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
  skillsSubmitting: boolean;
  doneSubmitting: boolean;
  workPatternSubmitting: boolean;
  majorsSubmitting: boolean;
  massageSaving: boolean;

  draftWorkPattern: SpecialistWorkPatternUi | null;
  setDraftWorkPattern: Dispatch<
    SetStateAction<SpecialistWorkPatternUi | null>
  >;
  draftMajorSlugs: string[];
  setDraftMajorSlugs: Dispatch<SetStateAction<string[]>>;

  photoPreviewUrl: string | null;
  photoFileLabel: string | null;

  queryClient: ReturnType<typeof useQueryClient>;
  refetch: () => Promise<unknown>;

  setStep: (n: number, serverOnboardingStep?: number) => void;
  onIntroContinue: () => Promise<void>;
  onWorkPatternContinue: () => Promise<void>;
  onMajorsContinue: () => Promise<void>;
  onProfileContinue: () => Promise<void>;
  onMassageContinue: () => Promise<void>;
  onSkillsContinue: () => Promise<void>;
  onOrgContinue: () => Promise<void>;
  submitCreateOrganizationFromOnboarding: (
    body: OrganizationSalonCabinetSubmitBody,
  ) => Promise<void>;
  onWorkplaceSkip: () => void;
  onDone: () => Promise<void>;
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
  const [pGender, setPGender] = useState<"male" | "female" | null>(null);
  const [pBio, setPBio] = useState("");
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoObjectUrl, setPendingPhotoObjectUrl] = useState<string | null>(
    null,
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [pExp, setPExp] = useState<ExperienceKey | null>(null);
  const [strength, setStrength] = useState(3);
  const [adapt, setAdapt] = useState(true);
  const [draftSkillCategoryIds, setDraftSkillCategoryIds] = useState(
    () => new Set<string>(),
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
  const [skillsSubmitting, setSkillsSubmitting] = useState(false);
  const [doneSubmitting, setDoneSubmitting] = useState(false);
  const [workPatternSubmitting, setWorkPatternSubmitting] = useState(false);
  const [majorsSubmitting, setMajorsSubmitting] = useState(false);
  const [massageSaving, setMassageSaving] = useState(false);
  const [draftWorkPattern, setDraftWorkPattern] = useState<
    SpecialistWorkPatternUi | null
  >(null);
  const [draftMajorSlugs, setDraftMajorSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!spec) {
      return;
    }
    setPName((prev) =>
      prev ? prev : (spec.listingName ?? spec.userName ?? "").trim() || "",
    );
    setPPhoneLocal((prev) => (prev ? prev : parseVnLocalForInput(spec.userPhone)));
    setPGender((prev) => prev ?? (spec.gender ?? null));
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
    if (!spec) {
      return;
    }
    setDraftWorkPattern(spec.onboardingWorkPattern ?? null);
    setDraftMajorSlugs([...(spec.onboardingMajorCategorySlugs ?? [])]);
  }, [spec]);

  useEffect(() => {
    const ids = spec?.skillServiceCategoryIds ?? [];
    setDraftSkillCategoryIds(new Set(ids));
  }, [spec?.skillServiceCategoryIds]);

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

  const maxUi = maxUiStepAllowed(apiStep);

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
        serverOnboardingStep != null ?
          maxUiStepAllowed(serverOnboardingStep as number)
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
      const stepAfter = fresh?.onboardingStep ?? 1;
      setStep(defaultWizardStepForApiStep(Number(stepAfter)), Number(stepAfter));
    } finally {
      setIntroSubmitting(false);
    }
  };

  const onWorkPatternContinue = useCallback(async () => {
    if (draftWorkPattern == null) {
      setFormError(t("vErrWorkPattern"));
      return;
    }
    setFormError(null);
    setWorkPatternSubmitting(true);
    try {
      const { error } =
        await specialistsCabinetPatchSpecialistOnboardingPreferences({
          client: sdk,
          query: { locale },
          body: { workPattern: draftWorkPattern },
        });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: [...ONB_QK, accessToken, locale],
      });
      const { data: o2 } = await refetch();
      const stepAfter = Number(o2?.onboardingStep ?? 1);
      setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
    } finally {
      setWorkPatternSubmitting(false);
    }
  }, [
    draftWorkPattern,
    sdk,
    locale,
    queryClient,
    accessToken,
    refetch,
    setStep,
    t,
  ]);

  const onMajorsContinue = useCallback(async () => {
    if (draftMajorSlugs.length < 1) {
      setFormError(t("vErrMajorsPickOne"));
      return;
    }
    setFormError(null);
    setMajorsSubmitting(true);
    try {
      const { error } =
        await specialistsCabinetPatchSpecialistOnboardingPreferences({
          client: sdk,
          query: { locale },
          body: { majorCategorySlugs: draftMajorSlugs },
        });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: [...ONB_QK, accessToken, locale],
      });
      const { data: o2 } = await refetch();
      const stepAfter = Number(o2?.onboardingStep ?? 1);
      setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
    } finally {
      setMajorsSubmitting(false);
    }
  }, [
    draftMajorSlugs,
    sdk,
    locale,
    queryClient,
    accessToken,
    refetch,
    setStep,
    t,
  ]);

  const onMassageContinue = useCallback(async () => {
    const touchOk =
      adapt === true ||
      (Number.isFinite(strength) && strength >= 1 && strength <= 5);
    if (!touchOk) {
      setFormError(t("vErrMassageTouch"));
      return;
    }
    setFormError(null);
    setMassageSaving(true);
    try {
      const { error } = await specialistsCabinetPatchSpecialistProfile({
        client: sdk,
        body: {
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
      await queryClient.invalidateQueries({
        queryKey: [...ONB_QK, accessToken, locale],
      });
      const { data: o2 } = await refetch();
      const stepAfter = Number(o2?.onboardingStep ?? 1);
      if (stepAfter === 5) {
        setFormError(t("vErrMassageTouch"));
        return;
      }
      setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
    } finally {
      setMassageSaving(false);
    }
  }, [
    adapt,
    strength,
    sdk,
    queryClient,
    accessToken,
    refetch,
    setStep,
    t,
  ]);

  const onProfileContinue = async () => {
    if (!pName.trim() || !pBio.trim() || pExp == null || pGender == null) {
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
          gender: pGender,
          phone: toE164Vietnam(pPhoneLocal),
          bio: pBio.trim(),
          experienceYears: keyToYears(pExp),
          ...(imageUrl != null ? { imageUrl } : {}),
        } as Record<string, unknown>,
      });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      setPendingPhotoFile(null);
      await queryClient.invalidateQueries({
        queryKey: [...ONB_QK, accessToken, locale],
      });
      const { data: o2 } = await refetch();
      const stepAfter = Number(o2?.onboardingStep ?? 1);
      if (stepAfter === 4) {
        setFormError(t("vErrName"));
        return;
      }
      setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
    } finally {
      setProfileSaving(false);
    }
  };

  const onSkillsContinue = async () => {
    if (draftSkillCategoryIds.size < 1) {
      setFormError(t("vErrSkillsPickOne"));
      return;
    }
    setFormError(null);
    setSkillsSubmitting(true);
    try {
      const { error } = await specialistsCabinetPatchSpecialistOnboardingPreferences({
        client: sdk,
        query: { locale },
        body: { serviceCategoryIds: [...draftSkillCategoryIds] },
      });
      if (error) {
        setFormError(t("vErrName"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      const { data: o2 } = await refetch();
      const stepAfter = Number(o2?.onboardingStep ?? 1);
      setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
    } finally {
      setSkillsSubmitting(false);
    }
  };

  const employedWorkplaceUi =
    spec?.onboardingWorkPattern === "employed_salon";

  useEffect(() => {
    if (activeUi === 6 && employedWorkplaceUi) {
      setOrgSuggestOpen(true);
    }
  }, [activeUi, employedWorkplaceUi]);

  useEffect(() => {
    if (activeUi !== 6 || !employedWorkplaceUi) {
      return;
    }
    const q = orgQ.trim();
    setOrgPending(true);
    const tmr = setTimeout(() => {
      void (async () => {
        const { data, error } = await organizationsGetWorkplaceOrganizationSearch({
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
  }, [activeUi, employedWorkplaceUi, orgQ, locale, sdk]);

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
      const stepAfter = Number(o2?.onboardingStep ?? 1);
      setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
    } finally {
      setWorkplaceSubmitting(false);
    }
  };

  const submitCreateOrganizationFromOnboarding = useCallback(
    async (body: OrganizationSalonCabinetSubmitBody) => {
      const pattern = spec?.onboardingWorkPattern;
      if (pattern !== "solo" && pattern !== "business") {
        setFormError(t("vErrWorkplaceCreateForbidden"));
        return;
      }
      setFormError(null);
      setCreateOrgSubmitting(true);
      try {
        const { error } = await organizationsCabinetPostCreateOrganization({
          client: sdk,
          query: { locale },
          body: { ...body, organizationType: pattern },
        });
        if (error) {
          setFormError(t("vErrCreateOrg"));
          return;
        }
        setCreateSalonOpen(false);
        await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
        const { data: o2 } = await refetch();
        const stepAfter = Number(o2?.onboardingStep ?? 1);
        setStep(defaultWizardStepForApiStep(stepAfter), stepAfter);
      } finally {
        setCreateOrgSubmitting(false);
      }
    },
    [accessToken, locale, queryClient, refetch, sdk, setStep, spec?.onboardingWorkPattern, t],
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
    pGender,
    setPGender,
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
    draftSkillCategoryIds,
    setDraftSkillCategoryIds,
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
    skillsSubmitting,
    doneSubmitting,
    workPatternSubmitting,
    majorsSubmitting,
    massageSaving,
    draftWorkPattern,
    setDraftWorkPattern,
    draftMajorSlugs,
    setDraftMajorSlugs,
    photoPreviewUrl,
    photoFileLabel,
    queryClient,
    refetch: refetch as SpecialistOnboardingContextValue["refetch"],
    setStep,
    onIntroContinue,
    onWorkPatternContinue,
    onMajorsContinue,
    onProfileContinue,
    onMassageContinue,
    onSkillsContinue,
    onOrgContinue,
    submitCreateOrganizationFromOnboarding,
    onWorkplaceSkip,
    onDone,
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
