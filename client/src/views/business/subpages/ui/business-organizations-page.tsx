"use client";

import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";

const ORGS_QK = ["specialistMyOrganizations"] as const;

function orgRoleLabelKey(role: string): "orgRoleOwner" | "orgRoleAdmin" | "orgRoleSpecialist" {
  if (role === "owner") {
    return "orgRoleOwner";
  }
  if (role === "admin") {
    return "orgRoleAdmin";
  }
  return "orgRoleSpecialist";
}

export function BusinessOrganizationsPage() {
  const t = useTranslations("businessAppSubpages");
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...ORGS_QK, accessToken, locale],
    enabled:
      sessionStatus === "authenticated" && typeof accessToken === "string" && accessToken.length > 0,
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistMyOrganizations({
        client: createBrowserSdkClient(accessToken, { locale }),
      });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });

  const organizations = data?.organizations ?? [];
  const showEmpty =
    sessionStatus === "authenticated" &&
    accessToken.length > 0 &&
    !isPending &&
    !isError &&
    organizations.length === 0;

  const showList = organizations.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("organizationsTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("organizationsTitle")}
        avatarFallback="B"
        actions={
          sessionStatus === "authenticated" && accessToken.length > 0 ?
            <div className="flex w-full min-w-0 flex-row flex-wrap items-stretch gap-2">
              <Button
                variant="secondary"
                tone="light"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-[0.9375rem] font-medium sm:px-5"
                asChild
              >
                <Link href="/business/organizations/join">{t("findJoinOrganization")}</Link>
              </Button>
              <Button
                variant="primary"
                className="h-11 min-w-0 flex-1 rounded-xl px-3 text-[0.9375rem] font-medium sm:px-5"
                asChild
              >
                <Link href="/business/organizations/new">{t("createOrganization")}</Link>
              </Button>
            </div>
          : undefined
        }
      />

      {sessionStatus === "loading" ? (
        <div className="space-y-3" aria-busy aria-label={t("orgsLoadingAria")}>
          <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
        </div>
      ) : sessionStatus === "unauthenticated" || !accessToken ? (
        <BusinessEmptyState
          icon={Building2}
          title={t("orgsSignInTitle")}
          description={t("orgsSignInHint")}
        />
      ) : isPending ? (
        <div
          className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
          aria-busy
          aria-label={t("orgsLoadingAria")}
        >
          <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
        </div>
      ) : isError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p className="font-medium">{t("orgsLoadError")}</p>
          <button
            type="button"
            className={cn(
              motion.interactive,
              "mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline",
            )}
            onClick={() => void refetch()}
          >
            {t("orgsRetry")}
          </button>
        </div>
      ) : showList ? (
        <ul
          className="flex flex-col gap-2.5"
          aria-label={t("orgListAria")}
          role="list"
        >
          {organizations.map((org) => (
            <li key={org.id}>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{org.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(orgRoleLabelKey(org.role))}
                    </p>
                    {org.isActiveWorkplace ?
                      <p className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {t("orgActiveWorkplaceBadge")}
                      </p>
                    : null}
                  </div>
                </div>
                <Link
                  href={`/organizations/${org.id}`}
                  className={cn(
                    motion.interactive,
                    "mt-3 flex w-full items-center justify-between gap-2 rounded-lg px-0 py-1 text-sm font-medium text-primary",
                  )}
                >
                  <span>{t("orgOpenPublicProfile")}</span>
                  <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        <BusinessEmptyState
          icon={Building2}
          title={t("emptyOrganizationsTitle")}
          description={t("emptyOrganizationsHint")}
        />
      ) : null}
    </main>
  );
}
