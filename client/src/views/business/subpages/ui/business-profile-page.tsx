"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  BusinessSpecialistCabinetProfile,
  type CabinetSpecialistBlob,
} from "@/entities/specialists";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistOnboarding,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui";

const ONB_QK = ["specialistOnboarding"] as const;

export function BusinessProfilePage() {
  const t = useTranslations("businessAppSubpages");
  useSetBusinessPageTitle(t("profileTitle"));
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

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-4 px-4 pt-2">
      {specialist != null && onboardQuery.isSuccess ?
        <div className="flex w-full min-w-0 flex-row flex-wrap items-stretch gap-2">
          <Button
            variant="secondary"
            tone="light"
            className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-[0.9375rem] font-medium sm:px-5"
            asChild
          >
            <Link href="/business/profile/edit">{t("profileEditButton")}</Link>
          </Button>
        </div>
      : null}

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
      : <BusinessSpecialistCabinetProfile specialist={specialist} />}
    </main>
  );
}
