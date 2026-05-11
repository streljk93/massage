"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  BusinessSpecialistCabinetProfile,
  type CabinetSpecialistBlob,
} from "@/entities/specialists";
import {
  createBrowserSdkClient,
  organizationsCabinetGetWorkplaceJoinApplicantCabinetProfile,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";

const APPLICANT_QK = ["workplaceJoinApplicantCabinetProfile"] as const;

export type BusinessWorkplaceApplicantProfilePageProps = {
  organizationId: string;
  specialistId: string;
};

export function BusinessWorkplaceApplicantProfilePage({
  organizationId,
  specialistId,
}: BusinessWorkplaceApplicantProfilePageProps) {
  const t = useTranslations("businessAppSubpages");
  useSetBusinessPageTitle(t("profileTitle"));
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const applicantQuery = useQuery({
    queryKey: [
      ...APPLICANT_QK,
      organizationId,
      specialistId,
      accessToken,
      locale,
    ] as const,
    enabled:
      sessionStatus === "authenticated" &&
      accessToken.length > 0 &&
      organizationId.length > 0 &&
      specialistId.length > 0,
    queryFn: async () => {
      const { data, error } =
        await organizationsCabinetGetWorkplaceJoinApplicantCabinetProfile({
          client: sdk,
          path: { organizationId, specialistId },
          query: { locale },
        });
      if (error || !data) {
        throw new Error("applicantCabinetProfile");
      }
      return data;
    },
  });

  const specialist = applicantQuery.data?.specialist as CabinetSpecialistBlob | undefined;

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-4 px-4 pt-2">
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
      : applicantQuery.isLoading ?
        <div
          className="flex justify-center py-12 text-muted-foreground"
          aria-busy
          aria-label={t("profileLoadingAria")}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : applicantQuery.isError ?
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
            onClick={() => void applicantQuery.refetch()}
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
