"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { useRouter } from "@/app/i18n/navigation";
import { BusinessEmptyState } from "@/entities/business";
import {
  keyToYears,
  SpecialistProfileEditForm,
  type CabinetSpecialistBlob,
  type ExperienceKey,
  yearsToKey,
} from "@/entities/specialists";
import {
  createBrowserSdkClient,
  filesUploadPublic,
  specialistsCabinetGetSpecialistOnboarding,
  specialistsCabinetPatchSpecialistProfile,
} from "@/shared/api";
import {
  isPlausibleVnNational,
  parseVnLocalForInput,
  toE164Vietnam,
} from "@/views/business/setup/lib/specialist-onboarding-utils";
import { resolveApiResourceUrl } from "@/shared/lib/resolve-api-resource-url";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { Button } from "@/shared/ui";

const ONB_QK = ["specialistOnboarding"] as const;

export function BusinessProfileEditPage() {
  const t = useTranslations("businessAppSubpages");
  const tOnb = useTranslations("specialistOnboarding");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const onboardQuery = useQuery({
    queryKey: [...ONB_QK, accessToken, locale] as const,
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

  const specialist = onboardQuery.data?.specialist as CabinetSpecialistBlob | null | undefined;

  const [formError, setFormError] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pPhoneLocal, setPPhoneLocal] = useState("");
  const [pBio, setPBio] = useState("");
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoObjectUrl, setPendingPhotoObjectUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pExp, setPExp] = useState<ExperienceKey | null>(null);
  const [strength, setStrength] = useState(3);
  const [adapt, setAdapt] = useState(true);
  const hydratedRef = useRef(false);

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
    if (!specialist || hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    const listing =
      specialist.listingName != null && String(specialist.listingName).trim().length > 0
        ? String(specialist.listingName).trim()
        : "";
    const userNm = String(specialist.userName ?? "").trim();
    setPName(listing || userNm);
    setPPhoneLocal(
      parseVnLocalForInput(
        specialist.userPhone == null ? null : String(specialist.userPhone),
      ),
    );
    setPBio(specialist.bio != null ? String(specialist.bio).trim() : "");
    setPExp(
      yearsToKey(
        typeof specialist.experienceYears === "number" &&
          Number.isFinite(specialist.experienceYears)
          ? specialist.experienceYears
          : null,
      ),
    );
    const m = specialist.massage as
      | { pressureLevel?: number | null; pressureAdaptsToClient?: boolean | null }
      | null
      | undefined;
    if (m?.pressureLevel != null && m.pressureLevel >= 1 && m.pressureLevel <= 5) {
      setStrength(m.pressureLevel);
    }
    if (m?.pressureAdaptsToClient != null) {
      setAdapt(!!m.pressureAdaptsToClient);
    }
  }, [specialist]);

  const specialistImagePath =
    specialist?.imageUrl != null && String(specialist.imageUrl).length > 0
      ? String(specialist.imageUrl)
      : null;
  const photoPreviewUrl =
    pendingPhotoObjectUrl ??
    (specialistImagePath ? resolveApiResourceUrl(specialistImagePath) : null);
  const photoFileLabel = pendingPhotoFile
    ? pendingPhotoFile.name
    : specialistImagePath
      ? tOnb("currentSpecialistPhoto")
      : null;

  const avatarFallback = (
    (specialist?.listingName != null && String(specialist.listingName).trim().length > 0 ?
      String(specialist.listingName).trim().slice(0, 2)
    : String(specialist?.userName ?? "").trim().slice(0, 2)) || "B"
  ).toUpperCase();

  const onSubmit = async () => {
    if (!pName.trim() || !pBio.trim() || pExp == null) {
      setFormError(tOnb("vErrName"));
      return;
    }
    if (!isPlausibleVnNational(pPhoneLocal)) {
      setFormError(tOnb("vErrPhone"));
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
        setFormError(tOnb("vErrPhoto"));
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
        setFormError(tOnb("vErrName"));
        return;
      }
      setPendingPhotoFile(null);
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      router.push("/business/profile");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-2 pb-6">
      <BusinessScreenHeader
        title={t("profileEditTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("profileEditTitle")}
        avatarFallback={avatarFallback}
        cabinetBack={{
          href: "/business/profile",
          ariaLabel: t("profileEditBackAria"),
        }}
      />

      {sessionStatus === "loading" || (sessionStatus === "authenticated" && accessToken.length === 0) ?
        <div
          className="flex justify-center py-12 text-muted-foreground"
          aria-busy
          aria-label={t("profileLoadingAria")}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : sessionStatus === "unauthenticated" || !accessToken ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("profileSignInTitle")}
          description={t("profileSignInHint")}
        />
      : onboardQuery.isLoading ?
        <div
          className="flex justify-center py-12 text-muted-foreground"
          aria-busy
          aria-label={t("profileLoadingAria")}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : onboardQuery.isError ?
        <div className="flex flex-col gap-3">
          <BusinessEmptyState
            icon={UsersRound}
            title={t("profileLoadError")}
            description={t("profileLoadErrorHint")}
          />
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-2xl"
            onClick={() => void onboardQuery.refetch()}
          >
            {t("profileRetry")}
          </Button>
        </div>
      : specialist == null ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("emptyProfileTitle")}
          description={t("emptyProfileHint")}
        />
      : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          noValidate
        >
          {formError != null && formError !== "" ?
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          : null}
          <SpecialistProfileEditForm
            showOnboardingIntro={false}
            profileSaving={profileSaving}
            photoPreviewUrl={photoPreviewUrl}
            photoFileLabel={photoFileLabel}
            onPhotoFileChosen={setPendingPhotoFile}
            name={pName}
            onNameChange={setPName}
            phoneLocal={pPhoneLocal}
            onPhoneLocalChange={setPPhoneLocal}
            bio={pBio}
            onBioChange={setPBio}
            experienceKey={pExp}
            onExperienceKeyChange={setPExp}
            strength={strength}
            onStrengthChange={setStrength}
            adapt={adapt}
            onAdaptChange={setAdapt}
          />
          <Button
            type="submit"
            className="h-12 w-full rounded-2xl font-medium"
            disabled={profileSaving}
            aria-busy={profileSaving}
          >
            {profileSaving ? tOnb("saving") : t("profileEditSave")}
          </Button>
        </form>
      )}
    </main>
  );
}
