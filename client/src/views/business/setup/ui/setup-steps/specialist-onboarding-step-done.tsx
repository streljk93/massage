"use client";

import { useTranslations } from "next-intl";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepDone() {
  const t = useTranslations("specialistOnboarding");
  const { spec } = useSpecialistOnboarding();

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("step5Title")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {spec?.pendingWorkplaceJoinRequest && !spec.activeOrganizationId ? (
          <span>
            {t("step5SubPendingWorkplace", {
              name: spec.pendingWorkplaceJoinRequest.organizationName,
            })}
          </span>
        ) : (
          t("step5Sub")
        )}
      </p>
    </section>
  );
}
