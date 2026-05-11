"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/app/i18n/navigation";
import {
  defaultWizardStepForApiStep,
  isSpecialistOnboardingComplete,
} from "@/entities/business";
import { createBrowserSdkClient, specialistsCabinetGetSpecialistOnboarding } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import type { AppLocale } from "@/app/i18n/routing";
import {
  BusinessCabinetHeaderProvider,
  BusinessScreenTitleSetContext,
  type CabinetHeaderLeadRole,
} from "./business-cabinet-nav-context";
import { BusinessAppBottomNav } from "./business-app-bottom-nav";
import { BusinessCabinetSidebar, BusinessCabinetSidebarShell } from "./business-cabinet-nav-drawer";
import { BusinessScreenHeader } from "./business-screen-header";

const ONB_QK = ["specialistOnboarding"] as const;

function isSetupPath(pathname: string): boolean {
  return (
    pathname === "/business/setup" || pathname.startsWith("/business/setup/")
  );
}

type BusinessLayerChromeProps = {
  children: React.ReactNode;
};

/**
 * Кабинет бизнеса: при незавершённом онбординге — полоса с переходом в настройку;
 * боковое меню в шапке (дровер) после `onboardingStep === 6`.
 */
export function BusinessLayerChrome({ children }: BusinessLayerChromeProps) {
  const pathname = usePathname();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("businessOnboarding");
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const { data: onboard, isFetched } = useQuery({
    queryKey: [...ONB_QK, accessToken, locale],
    enabled: status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistOnboarding({
        client: createBrowserSdkClient(accessToken, { locale }),
        query: { locale },
      });
      if (error || !data) {
        throw new Error("onboarding");
      }
      return data;
    },
  });

  const ready = useMemo(() => {
    if (status === "loading") {
      return false;
    }
    if (status === "unauthenticated" || !accessToken) {
      return true;
    }
    return isFetched;
  }, [status, accessToken, isFetched]);

  const setupComplete =
    status === "authenticated" && isFetched
      ? isSpecialistOnboardingComplete(onboard ?? null)
      : false;

  const headerLead = useMemo((): CabinetHeaderLeadRole => {
    // Визард настройки — вне каркаса кабинета: без бургера и дровера
    if (isSetupPath(pathname)) {
      if (status === "unauthenticated") {
        return "back";
      }
      return "none";
    }
    if (status === "loading") {
      return "menuPending";
    }
    if (status === "unauthenticated") {
      return "back";
    }
    if (status === "authenticated") {
      if (!accessToken) {
        return "menuPending";
      }
      if (!isFetched) {
        return "menuPending";
      }
      return "menu";
    }
    return "back";
  }, [pathname, status, accessToken, isFetched]);

  const showIncompleteStrip =
    ready &&
    status === "authenticated" &&
    isFetched &&
    !setupComplete &&
    !isSetupPath(pathname);

  const continueSetupHref = useMemo(() => {
    const step = defaultWizardStepForApiStep(
      (onboard?.onboardingStep as number) ?? 1,
    );
    return `/business/setup/${step}` as const;
  }, [onboard?.onboardingStep]);

  const [pageTitle, setPageTitle] = useState("");

  const showBusinessBottomNav =
    ready &&
    status === "authenticated" &&
    setupComplete &&
    !isSetupPath(pathname);

  const showSidebar =
    ready && status === "authenticated" && setupComplete && !isSetupPath(pathname);

  /** Десктоп: резервируем колонку под сайдбар до готовности сессии/онбординга, чтобы контент не прыгал на всю ширину. */
  const showSidebarPendingShell =
    !isSetupPath(pathname) &&
    (status === "loading" ||
      (status === "authenticated" &&
        accessToken.length > 0 &&
        !isFetched));
  return (
    <BusinessCabinetHeaderProvider lead={headerLead}>
      <BusinessScreenTitleSetContext.Provider value={setPageTitle}>
        {/*
         * Mobile:  flex-col — шапка + контент + нижняя панель
         * Desktop: flex-row — постоянный сайдбар слева (в потоке), контент справа
         */}
        <div className="flex min-h-screen flex-col bg-background md:flex-row">

          {/* Сайдбар — только десктоп, только после авторизации + онбординг */}
          {showSidebar ? (
            <div className="hidden md:block">
              <BusinessCabinetSidebar />
            </div>
          ) : showSidebarPendingShell ? (
            <div className="hidden md:block">
              <BusinessCabinetSidebarShell />
            </div>
          ) : null}

          {/* Основная колонка */}
          <div className="flex min-w-0 flex-1 flex-col">

            {/* Полоса «онбординг не завершён» */}
            {showIncompleteStrip ? (
              <div
                className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center"
                role="status"
              >
                <p className="text-pretty text-sm text-foreground/90">
                  {t("incompleteBanner")}
                </p>
                <Link
                  href={continueSetupHref}
                  className="mt-1 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t("reminderCta")}
                </Link>
              </div>
            ) : null}

            {/* Шапка + страница: общая max-width на широких экранах, по центру колонки */}
            <div
              className={cn(
                "mx-auto flex min-h-0 w-full min-w-0 max-w-5xl flex-1 flex-col",
                isSetupPath(pathname) && "max-w-none",
              )}
            >
              {!isSetupPath(pathname) ? (
                <div className="px-4 pt-2 pb-1">
                  <BusinessScreenHeader
                    title={pageTitle}
                    titleVariant="section"
                    avatarFallback="B"
                  />
                </div>
              ) : null}

              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col",
                  isSetupPath(pathname) ? "pb-0"
                  : showBusinessBottomNav ?
                    "pb-[calc(3.875rem+1rem+env(safe-area-inset-bottom))] md:pb-4"
                  : "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4",
                )}
              >
                {children}
              </div>
            </div>

            {/* Нижняя панель «место приёма» — только мобайл */}
            {showBusinessBottomNav ? (
              <div className="md:hidden">
                <BusinessAppBottomNav />
              </div>
            ) : null}

          </div>
        </div>
      </BusinessScreenTitleSetContext.Provider>
    </BusinessCabinetHeaderProvider>
  );
}
