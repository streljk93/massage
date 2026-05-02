"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { Link } from "@/app/i18n/navigation";
import { BusinessEmptyState } from "@/entities/business";
import {
  specialistPersonalServicesFromCabinetBlob,
  type CabinetSpecialistBlob,
} from "@/entities/specialists";
import { createBrowserSdkClient, specialistsCabinetGetSpecialistOnboarding } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { BusinessPersonalServiceForm } from "./business-personal-service-form";

const ONB_QK = ["specialistOnboarding"] as const;

export function BusinessServiceNewPage() {
  const t = useTranslations("businessServicesPage");
  const locale = useLocale() as AppLocale;
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

  const avatarFallback = (
    (specialist?.listingName != null && String(specialist.listingName).trim().length > 0 ?
      String(specialist.listingName).trim().slice(0, 2)
    : String(specialist?.userName ?? "").trim().slice(0, 2)) || "B"
  ).toUpperCase();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-2 pb-6">
      <BusinessScreenHeader
        title={t("formNewTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("formNewTitle")}
        avatarFallback={avatarFallback}
        cabinetBack={{
          href: "/business/services",
          ariaLabel: t("formBackAria"),
        }}
      />

      {sessionStatus === "loading" || (sessionStatus === "authenticated" && accessToken.length === 0) ?
        <div className="flex justify-center py-12 text-muted-foreground" aria-busy>
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : sessionStatus === "unauthenticated" || !accessToken ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("signInTitle")}
          description={t("signInHint")}
        />
      : onboardQuery.isLoading ?
        <div className="flex justify-center py-12 text-muted-foreground" aria-busy>
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : onboardQuery.isError ?
        <div className="flex flex-col gap-3">
          <BusinessEmptyState
            icon={UsersRound}
            title={t("loadErrorTitle")}
            description={t("loadErrorHint")}
          />
          <Link
            href="/business/services"
            className="text-center text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("formBackAria")}
          </Link>
        </div>
      : specialist == null ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("emptyProfileTitle")}
          description={t("emptyProfileHint")}
        />
      : <BusinessPersonalServiceForm mode="create" />}
    </main>
  );
}
