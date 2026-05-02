"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";
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
import { Button } from "@/shared/ui";
import { BusinessPersonalServiceForm } from "./business-personal-service-form";

const ONB_QK = ["specialistOnboarding"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BusinessServiceEditPage() {
  const params = useParams();
  const rawId = params.serviceId;
  const serviceId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  const idValid = UUID_RE.test(serviceId);

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
    enabled:
      sessionStatus === "authenticated" &&
      accessToken.length > 0 &&
      idValid,
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

  const row = useMemo(() => {
    if (!idValid || specialist == null) {
      return null;
    }
    return specialistPersonalServicesFromCabinetBlob(specialist).find((s) => s.id === serviceId) ?? null;
  }, [idValid, specialist, serviceId]);

  const avatarFallback = (
    (specialist?.listingName != null && String(specialist.listingName).trim().length > 0 ?
      String(specialist.listingName).trim().slice(0, 2)
    : String(specialist?.userName ?? "").trim().slice(0, 2)) || "B"
  ).toUpperCase();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-2 pb-6">
      <BusinessScreenHeader
        title={t("formEditTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("formEditTitle")}
        avatarFallback={avatarFallback}
        cabinetBack={{
          href: "/business/services",
          ariaLabel: t("formBackAria"),
        }}
      />

      {!idValid ?
        <div className="flex flex-col gap-3">
          <BusinessEmptyState
            icon={UsersRound}
            title={t("serviceNotFoundTitle")}
            description={t("serviceNotFoundHint")}
          />
          <Button variant="secondary" tone="light" className="h-11 rounded-xl" asChild>
            <Link href="/business/services">{t("formBackAria")}</Link>
          </Button>
        </div>
      : sessionStatus === "loading" || (sessionStatus === "authenticated" && accessToken.length === 0) ?
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
          <Button
            type="button"
            variant="secondary"
            tone="light"
            className="h-11 rounded-xl"
            onClick={() => void onboardQuery.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      : specialist == null ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("emptyProfileTitle")}
          description={t("emptyProfileHint")}
        />
      : row == null ?
        <div className="flex flex-col gap-3">
          <BusinessEmptyState
            icon={UsersRound}
            title={t("serviceNotFoundTitle")}
            description={t("serviceNotFoundHint")}
          />
          <Button variant="secondary" tone="light" className="h-11 rounded-xl" asChild>
            <Link href="/business/services">{t("formBackAria")}</Link>
          </Button>
        </div>
      : (
        <BusinessPersonalServiceForm
          mode="edit"
          serviceId={serviceId}
          initial={{
            categoryId: row.categoryId,
            priceOptions: row.priceOptions.map((o) => ({
              durationMinutes: o.durationMinutes,
              priceAmount: o.priceAmount,
            })),
          }}
        />
      )}
    </main>
  );
}
