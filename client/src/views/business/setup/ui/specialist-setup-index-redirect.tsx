"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  defaultWizardStepForApiStep,
  maxUiStepAllowed,
} from "@/entities/business";
import { createBrowserSdkClient, specialistsCabinetGetSpecialistOnboarding } from "@/shared/api";
import { loginHrefWithReturn } from "@/shared/lib";
import { SPECIALIST_ONBOARDING_ENTRY_PATH } from "@/views/become-specialist/lib/specialist-onboarding-entry";
import { ONB_QK } from "./specialist-onboarding-context";
import { clampUi } from "../lib/specialist-onboarding-utils";

const setupLoginHref = loginHrefWithReturn(SPECIALIST_ONBOARDING_ENTRY_PATH);

/**
 * `/business/setup` → редирект на шаг по данным онбординга.
 * Поддержка старых ссылок: `?step=`.
 */
export function SpecialistSetupIndexRedirect() {
  const t = useTranslations("specialistOnboarding");
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyStep = searchParams.get("step");
  const locale = useLocale() as AppLocale;
  const { status, data: session } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const { data: onboard, isFetched } = useQuery({
    queryKey: [...ONB_QK, accessToken, locale],
    enabled: status === "authenticated" && accessToken.length > 0,
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(setupLoginHref);
      return;
    }
    if (status === "loading" || (status === "authenticated" && accessToken.length === 0)) {
      return;
    }
    if (accessToken.length === 0) {
      return;
    }
    if (!isFetched) {
      return;
    }
    const apiStep = onboard?.onboardingStep ?? 1;
    const maxUi = maxUiStepAllowed(Number(apiStep) || 1);
    const fallback = defaultWizardStepForApiStep(apiStep);
    const parsedLegacy =
      legacyStep != null ? clampUi(parseInt(legacyStep, 10)) : fallback;
    const target = Math.min(parsedLegacy, maxUi);
    router.replace(`/business/setup/${target}`);
  }, [
    status,
    accessToken,
    isFetched,
    onboard?.onboardingStep,
    legacyStep,
    router,
  ]);

  if (status === "unauthenticated") {
    return (
      <div
        className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  if (status === "loading" || (status === "authenticated" && accessToken.length === 0)) {
    return (
      <div
        className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
      aria-hidden
    />
  );
}
