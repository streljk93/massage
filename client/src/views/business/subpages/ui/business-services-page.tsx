"use client";

import { Loader2, ListChecks, Pencil, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { Link } from "@/app/i18n/navigation";
import { BusinessEmptyState } from "@/entities/business";
import {
  specialistPersonalServicesFromCabinetBlob,
  type CabinetSpecialistBlob,
  type SpecialistCabinetPersonalServiceRow,
} from "@/entities/specialists";
import { confirmAction } from "@/shared/lib/notifications/confirm-action";
import {
  createBrowserSdkClient,
  specialistsCabinetDeleteSpecialistPersonalService,
  specialistsCabinetGetSpecialistOnboarding,
} from "@/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib";

const ONB_QK = ["specialistOnboarding"] as const;

function formatLinePrice(
  fmt: ReturnType<typeof useFormatter>,
  amount: number,
  currency: string,
): string {
  try {
    return fmt.number(amount, { style: "currency", currency });
  } catch {
    return fmt.number(amount);
  }
}

function PersonalServiceCabinetCard({
  svc,
  format,
  tOnb,
  deletingId,
  deletePending,
  onDelete,
}: {
  svc: SpecialistCabinetPersonalServiceRow;
  format: ReturnType<typeof useFormatter>;
  tOnb: (key: string) => string;
  deletingId: string | null;
  deletePending: boolean;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("businessServicesPage");
  const inactive = !svc.listedAtActiveWorkplace;
  return (
    <li className="relative w-full min-w-0 max-w-full">
      <article
        className={cn(
          "w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-card p-3 pr-20 text-card-foreground",
          inactive ?
            "border-dashed border-muted-foreground/40 bg-muted/20"
          : "border-border/60",
        )}
        {...(inactive ?
          { "aria-label": t("serviceInactiveCardAria", { name: svc.categoryName }) }
        : {})}
      >
        <div className="min-w-0">
          <h3
            className={cn(
              "font-heading text-sm font-semibold leading-snug",
              inactive ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {svc.categoryName}
          </h3>
          {inactive ?
            <span className="mt-1 inline-flex w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {t("serviceInactiveBadge")}
            </span>
          : null}
          {inactive ?
            <p className="mt-1.5 text-pretty text-xs leading-snug text-muted-foreground">
              {t("serviceInactiveHint")}
            </p>
          : null}
          <ul className="mt-2 space-y-1">
            {svc.priceOptions.map((o, idx) => (
              <li
                key={`${svc.id}-${o.durationMinutes}-${idx}`}
                className={cn(
                  "text-sm tabular-nums",
                  inactive ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {o.durationMinutes}
                {"\u00a0"}
                {tOnb("duration")}
                {" · "}
                {formatLinePrice(format, o.priceAmount, o.currency)}
              </li>
            ))}
          </ul>
        </div>
      </article>
      <div className="absolute right-3 top-3 z-[1] flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          asChild
        >
          <Link href={`/business/services/${svc.id}/edit`} aria-label={t("editAria")}>
            <Pencil className="size-[1.125rem]" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-destructive"
          disabled={deletingId === svc.id || deletePending}
          aria-label={t("deleteAria")}
          onClick={() => void onDelete(svc.id)}
        >
          {deletingId === svc.id ?
            <Loader2 className="size-[1.125rem] animate-spin" aria-hidden />
          : <Trash2 className="size-[1.125rem]" aria-hidden />}
        </Button>
      </div>
    </li>
  );
}

export function BusinessServicesPage() {
  const t = useTranslations("businessServicesPage");
  const tOnb = useTranslations("specialistOnboarding");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
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

  const personalServices = useMemo(
    () => specialistPersonalServicesFromCabinetBlob(specialist ?? null),
    [specialist],
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await specialistsCabinetDeleteSpecialistPersonalService({
        client: sdk,
        path: { serviceId },
      });
      if (error) {
        throw new Error("delete");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...ONB_QK, accessToken, locale],
      });
    },
  });

  const avatarFallback = (
    (specialist?.listingName != null && String(specialist.listingName).trim().length > 0 ?
      String(specialist.listingName).trim().slice(0, 2)
    : String(specialist?.userName ?? "").trim().slice(0, 2)) || "B"
  ).toUpperCase();

  async function onDelete(serviceId: string) {
    const ok = await confirmAction({
      title: t("deleteConfirmTitle"),
      description: t("deleteConfirmDescription"),
      confirmLabel: t("deleteConfirmSubmit"),
      cancelLabel: t("deleteConfirmCancel"),
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setDeletingId(serviceId);
    setFormError(null);
    try {
      await deleteMutation.mutateAsync(serviceId);
    } catch {
      setFormError(t("deleteError"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-2 pb-6">
      <BusinessScreenHeader
        title={t("title")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("title")}
        avatarFallback={avatarFallback}
        actions={
          specialist != null && onboardQuery.isSuccess ?
            <div className="flex w-full min-w-0 flex-row flex-wrap items-stretch gap-2">
              <Button
                variant="primary"
                className="h-11 min-w-0 flex-1 rounded-xl px-3 text-[0.9375rem] font-medium sm:px-5"
                asChild
              >
                <Link href="/business/services/new">{t("addServiceCta")}</Link>
              </Button>
            </div>
          : undefined
        }
      />

      {formError ?
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      : null}

      {sessionStatus === "loading" || (sessionStatus === "authenticated" && accessToken.length === 0) ?
        <div
          className="flex justify-center py-12 text-muted-foreground"
          aria-busy
          aria-label={t("loadingAria")}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : sessionStatus === "unauthenticated" || !accessToken ?
        <BusinessEmptyState
          icon={ListChecks}
          title={t("signInTitle")}
          description={t("signInHint")}
        />
      : onboardQuery.isLoading ?
        <div
          className="flex justify-center py-12 text-muted-foreground"
          aria-busy
          aria-label={t("loadingAria")}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : onboardQuery.isError ?
        <div className="flex flex-col gap-3">
          <BusinessEmptyState
            icon={ListChecks}
            title={t("loadErrorTitle")}
            description={t("loadErrorHint")}
          />
          <Button
            type="button"
            variant="secondary"
            tone="light"
            className="h-12 w-full rounded-2xl"
            onClick={() => void onboardQuery.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      : specialist == null ?
        <BusinessEmptyState
          icon={ListChecks}
          title={t("emptyProfileTitle")}
          description={t("emptyProfileHint")}
        />
      : (
        <section aria-label={t("listAria")} className="flex flex-col gap-3">
          {personalServices.length === 0 ?
            <div className="rounded-xl border border-dashed border-border/45 bg-muted/[0.04] px-4 py-10 text-center dark:bg-muted/[0.08]">
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{t("emptyHint")}</p>
              <Button
                variant="primary"
                className="mx-auto mt-4 h-11 w-full max-w-md rounded-xl px-3 text-[0.9375rem] font-medium sm:px-5"
                asChild
              >
                <Link href="/business/services/new">{t("addServiceCta")}</Link>
              </Button>
            </div>
          : (
            <ul className="flex flex-col gap-3" role="list">
              {personalServices.map((svc) => (
                <PersonalServiceCabinetCard
                  key={svc.id}
                  svc={svc}
                  format={format}
                  tOnb={tOnb}
                  deletingId={deletingId}
                  deletePending={deleteMutation.isPending}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
