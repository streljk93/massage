"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { Button } from "@/shared/ui";
import { SpecialistOnboardingStepper } from "./specialist-onboarding-stepper";
import { useSpecialistOnboardingCatalogCategories } from "../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "./specialist-onboarding-context";

export function SpecialistOnboardingChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("specialistOnboarding");
  const tSetup = useTranslations("specialistAccountSetup");
  const {
    sessionLoading,
    unauthenticated,
    onboardingLoading,
    ready,
    activeUi,
    formError,
    createSalonOpen,
    introSubmitting,
    profileSaving,
    servicesSubmitting,
    workplaceSubmitting,
    createOrgSubmitting,
    doneSubmitting,
    onIntroContinue,
    onProfileContinue,
    onServicesContinue,
    onOrgContinue,
    onWorkplaceSkip,
    onDone,
  } = useSpecialistOnboarding();

  const serviceStepCatalog = useSpecialistOnboardingCatalogCategories(activeUi === 3);
  const servicesContinueBlocked =
    activeUi === 3 &&
    (serviceStepCatalog.isLoading || !serviceStepCatalog.data?.length);

  const topChromeRef = useRef<HTMLDivElement | null>(null);
  const bottomChromeRef = useRef<HTMLDivElement | null>(null);
  const [topChromeHeightPx, setTopChromeHeightPx] = useState(168);
  const [bottomChromeHeightPx, setBottomChromeHeightPx] = useState(100);

  useLayoutEffect(() => {
    if (sessionLoading || unauthenticated || onboardingLoading || !ready) {
      return;
    }
    const top = topChromeRef.current;
    const bottom = bottomChromeRef.current;
    if (!top || !bottom) {
      return;
    }
    const measure = () => {
      setTopChromeHeightPx(top.getBoundingClientRect().height);
      setBottomChromeHeightPx(bottom.getBoundingClientRect().height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(top);
    ro.observe(bottom);
    return () => {
      ro.disconnect();
    };
  }, [
    sessionLoading,
    unauthenticated,
    onboardingLoading,
    ready,
    activeUi,
    formError,
  ]);

  if (sessionLoading) {
    return (
      <div
        className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  if (unauthenticated) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("vErrName")}
      </p>
    );
  }

  if (onboardingLoading) {
    return (
      <div
        className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full max-w-md flex-1 flex-col">
      <div
        ref={topChromeRef}
        className="fixed left-0 right-0 top-0 z-50 border-b border-border/40 bg-surface-light/95 pt-[max(0.5rem,env(safe-area-inset-top,0px))] backdrop-blur-sm supports-[backdrop-filter]:bg-surface-light/90"
      >
        <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-3">
          <BusinessScreenHeader
            title={tSetup("title")}
            titleVariant="section"
            showHeadline={false}
            avatarAlt={tSetup("title")}
            avatarFallback="S"
          />
          <SpecialistOnboardingStepper
            current={activeUi}
            total={5}
            aria={t("stepperAria")}
          />
          {formError ? (
            <p className="text-pretty text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto [scrollbar-gutter:stable] px-4"
        style={{
          paddingTop: topChromeHeightPx + 8 + 16,
          paddingBottom: bottomChromeHeightPx + 4 + 16,
        }}
      >
        {children}
      </div>

      <div
        ref={bottomChromeRef}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-surface-light/95 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm supports-[backdrop-filter]:bg-surface-light/90"
      >
        <div className="mx-auto w-full max-w-lg space-y-2 px-4">
          {activeUi === 1 ? (
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              onClick={() => {
                void onIntroContinue();
              }}
              disabled={introSubmitting}
            >
              {introSubmitting ? t("saving") : t("continue")}
            </Button>
          ) : null}
          {activeUi === 2 ? (
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              onClick={() => {
                void onProfileContinue();
              }}
              disabled={profileSaving}
            >
              {profileSaving ? t("saving") : t("continue")}
            </Button>
          ) : null}
          {activeUi === 3 ? (
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              onClick={() => {
                void onServicesContinue();
              }}
              disabled={servicesSubmitting || servicesContinueBlocked}
            >
              {servicesSubmitting ? t("saving") : t("continue")}
            </Button>
          ) : null}
          {activeUi === 4 ? (
            <>
              <Button
                type="button"
                className="h-12 w-full rounded-full"
                onClick={() => {
                  void onOrgContinue();
                }}
                disabled={
                  workplaceSubmitting || createOrgSubmitting || createSalonOpen
                }
              >
                {workplaceSubmitting ? t("saving") : t("workplaceRequestSubmit")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full rounded-full"
                onClick={onWorkplaceSkip}
                disabled={createOrgSubmitting}
              >
                {t("skip")}
              </Button>
            </>
          ) : null}
          {activeUi === 5 ? (
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              onClick={() => {
                void onDone();
              }}
              disabled={doneSubmitting}
            >
              {doneSubmitting ? t("saving") : t("goDashboard")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
