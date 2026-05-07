"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  OrganizationSalonCabinetForm,
  type OrganizationSalonCabinetFormInitialValues,
} from "@/entities/organizations";
import { filesUploadPublic } from "@/shared/api";
import { SearchAutocomplete } from "@/shared/ui";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

function majorsInitialValues(
  majors: string[] | undefined,
): OrganizationSalonCabinetFormInitialValues | null {
  if (majors == null || majors.length === 0) {
    return null;
  }
  return {
    name: "",
    description: "",
    addrQ: "",
    placePicked: null,
    legacyCoordinates: null,
    phoneLocal: "",
    email: "",
    website: "",
    years: "",
    majorCategorySlugs: [...majors],
    gallery: [],
  };
}

export default function SpecialistOnboardingStepWorkplace() {
  const t = useTranslations("specialistOnboarding");
  const {
    sdk,
    orgQ,
    setOrgQ,
    orgHits,
    orgPicked,
    setOrgPicked,
    orgSuggestOpen,
    setOrgSuggestOpen,
    orgPending,
    workplaceSubmitting,
    createOrgSubmitting,
    formError,
    setFormError,
    locale,
    accessToken,
    submitCreateOrganizationFromOnboarding,
    spec,
  } = useSpecialistOnboarding();

  const pattern = spec?.onboardingWorkPattern ?? null;
  const isEmployed = pattern === "employed_salon";

  const orgFormInitialValues = useMemo(
    () => majorsInitialValues(spec?.onboardingMajorCategorySlugs),
    [spec?.onboardingMajorCategorySlugs],
  );

  const orgFormSyncKey = useMemo(() => {
    const m = spec?.onboardingMajorCategorySlugs ?? [];
    return `onboarding-org-${pattern ?? "unknown"}-${[...m].sort().join(",")}`;
  }, [pattern, spec?.onboardingMajorCategorySlugs]);

  if (isEmployed) {
    return (
      <section className="space-y-3">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {t("stepWorkplaceJoinTitle")}
        </h1>
        <p className="text-pretty text-[0.9375rem] text-muted-foreground">{t("stepWorkplaceJoinSub")}</p>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground" id="org-search-label">
            {t("searchOrg")}
          </span>
          <SearchAutocomplete
            value={orgQ}
            onValueChange={(v) => {
              setOrgQ(v);
              setOrgPicked(null);
              setOrgSuggestOpen(true);
            }}
            onSelect={(item) => {
              setOrgPicked(item.id);
              setOrgQ(item.name);
              setOrgSuggestOpen(false);
            }}
            items={orgHits}
            isLoading={orgPending}
            selectedId={orgPicked}
            listOpen={orgSuggestOpen}
            onListOpenChange={setOrgSuggestOpen}
            minQueryLength={0}
            inputId="org-workplace-combobox"
            listboxId="org-workplace-listbox"
            inputLabelledBy="org-search-label"
            placeholder={t("searchPlaceholder")}
            listAriaLabel={t("searchOrg")}
            loadingText={t("orgSearchLoading")}
            emptyText={t("orgSearchEmpty")}
            disabled={workplaceSubmitting || createOrgSubmitting}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("stepWorkplaceCreateTitle")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">{t("stepWorkplaceCreateSub")}</p>
      <OrganizationSalonCabinetForm
        t={t}
        client={sdk}
        locale={locale}
        catalogQueryAccessToken={accessToken}
        initialSyncKey={orgFormSyncKey}
        initialValues={orgFormInitialValues}
        formError={formError}
        onClearFormError={() => setFormError(null)}
        reportError={setFormError}
        submitting={createOrgSubmitting}
        submitLabel={t("createSalonSubmit")}
        sectionTitle={t("orgFormTitle")}
        sectionHint={t("orgFormHint")}
        uploadPublicFile={async (file) => {
          const up = await filesUploadPublic({ client: sdk, body: { file } });
          if (up.error || !up.data?.url) {
            throw new Error("upload");
          }
          return up.data.url;
        }}
        onSubmit={submitCreateOrganizationFromOnboarding}
        hideMajorCategoryPicker={orgFormInitialValues != null}
      />
    </section>
  );
}
