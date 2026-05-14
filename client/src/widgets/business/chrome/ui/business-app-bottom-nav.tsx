"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  BusinessActiveOrganizationContextCard,
  pickActiveWorkplaceOrganization,
  useSpecialistMyOrganizationsQuery,
} from "@/entities/organizations";
import { cn } from "@/shared/lib";

/**
 * Нижняя плашка ЛК бизнеса: контекст места приёма, только если включено «Принимаю здесь».
 * Каркас рендерит панель только при активном workplace; иначе компонент не монтируется.
 */
export function BusinessAppBottomNav() {
  const t = useTranslations("businessAppNav");
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = status === "authenticated";
  const canLoadOrgs = authed && accessToken.length > 0;
  const orgsQuery = useSpecialistMyOrganizationsQuery({ enabled: authed });
  const activeOrg = pickActiveWorkplaceOrganization(orgsQuery.data);
  const orgsFetchPending = canLoadOrgs && orgsQuery.isPending;

  if (!authed) {
    return null;
  }

  if (orgsFetchPending) {
    return (
      <div
        className={cn(
          "fixed bottom-0 left-1/2 z-50 w-full max-w-6xl -translate-x-1/2",
          "flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border/40",
          "bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-md",
        )}
        role="region"
        aria-label={t("workplaceStripLoadingAria")}
      >
        <div className="bg-muted/15">
          <div className="px-3 pt-2 pb-2">
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
          </div>
        </div>
      </div>
    );
  }

  if (activeOrg == null) {
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
      aria-label={t("activeWorkplaceBarLabel")}
    >
      <div className="bg-muted/15">
        <div className="px-3 pt-2 pb-2">
          <BusinessActiveOrganizationContextCard
            organization={activeOrg}
            className="rounded-xl bg-card/80"
          />
        </div>
      </div>
    </div>
  );
}
