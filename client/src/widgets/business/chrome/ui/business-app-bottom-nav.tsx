"use client";

import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import {
  BusinessActiveOrganizationContextCard,
  pickActiveWorkplaceOrganization,
  useSpecialistMyOrganizationsQuery,
} from "@/entities/organizations";
import { cn, motion } from "@/shared/lib";

/**
 * Нижняя плашка ЛК бизнеса: только контекст выбранной организации (рабочая точка).
 */
export function BusinessAppBottomNav() {
  const t = useTranslations("businessAppNav");
  const tCard = useTranslations("businessActiveOrganizationContextCard");
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = status === "authenticated";
  const canLoadOrgs = authed && accessToken.length > 0;
  const orgsQuery = useSpecialistMyOrganizationsQuery({ enabled: authed });
  const activeOrg = pickActiveWorkplaceOrganization(orgsQuery.data);
  const orgsFetchPending = canLoadOrgs && orgsQuery.isPending;
  const orgsFetched = canLoadOrgs && !orgsQuery.isPending;
  const showConfigureWorkplace = orgsFetched && activeOrg == null;
  const showSkeleton = authed && (!canLoadOrgs || orgsFetchPending);

  if (!authed) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-1/2 z-50 w-full max-w-6xl -translate-x-1/2",
        "flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border/40",
        "bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-md",
      )}
      role="region"
      aria-label={
        showSkeleton ?
          t("workplaceStripLoadingAria")
        : showConfigureWorkplace ?
          t("configureWorkplaceBarRegionAria")
        : t("activeWorkplaceBarLabel")
      }
    >
      <div className="bg-muted/15">
        <div className="px-3 pt-2 pb-2">
          {showSkeleton ?
            <div
              className="flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-xl bg-card/80 px-3 py-1.5"
              aria-busy
              aria-label={t("workplaceStripLoadingAria")}
            >
              <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted/45" />
              <div className="min-w-0 flex-1 space-y-1.5 py-0.5 text-left">
                <div className="h-2 w-14 max-w-[40%] animate-pulse rounded bg-muted/45" />
                <div className="h-3 w-[65%] max-w-full animate-pulse rounded bg-muted/45" />
              </div>
            </div>
          : activeOrg != null ?
            <BusinessActiveOrganizationContextCard
              organization={activeOrg}
              className="rounded-xl bg-card/80"
            />
          : <Link
              href="/business/organizations"
              title={t("configureWorkplaceLinkAria")}
              aria-label={t("configureWorkplaceLinkAria")}
              className={cn(
                motion.interactivePressStrong,
                "flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-xl bg-card/80 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <div
                className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted/40"
                aria-hidden
              >
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Plus className="size-5" strokeWidth={2} aria-hidden />
                </div>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[0.65rem] leading-none font-medium text-muted-foreground">
                  {tCard("label")}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold leading-tight tracking-tight text-foreground">
                  {t("configureWorkplaceCta")}
                </p>
              </div>
            </Link>
          }
        </div>
      </div>
    </div>
  );
}
