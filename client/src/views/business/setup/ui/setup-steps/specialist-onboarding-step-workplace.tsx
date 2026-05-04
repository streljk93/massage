"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  OrganizationSalonCabinetForm,
} from "@/entities/organizations";
import { filesUploadPublic } from "@/shared/api";
import { Button, SearchAutocomplete } from "@/shared/ui";
import { useSpecialistOnboardingCatalogCategories } from "../../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepWorkplace() {
  const t = useTranslations("specialistOnboarding");
  const { data: categories = [], isLoading: categoriesLoading } =
    useSpecialistOnboardingCatalogCategories(true);
  const [salonFormInstance, setSalonFormInstance] = useState(0);
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
    createSalonOpen,
    setCreateSalonOpen,
    formError,
    setFormError,
    locale,
    submitCreateOrganizationFromOnboarding,
  } = useSpecialistOnboarding();

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("step4Title")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">{t("step4Sub")}</p>
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
      <div className="pt-1">
        <Button
          type="button"
          variant="ghost"
          className="h-12 w-full rounded-2xl border-0 bg-muted/45 px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground/80"
          disabled={
            workplaceSubmitting ||
            createOrgSubmitting ||
            categories.length < 1 ||
            categoriesLoading
          }
          onClick={() => {
            setFormError(null);
            setSalonFormInstance((n) => n + 1);
            setCreateSalonOpen(true);
          }}
        >
          {t("addOrgCta")}
        </Button>
      </div>
      {createSalonOpen ?
        <OrganizationSalonCabinetForm
          t={t}
          client={sdk}
          locale={locale}
          categories={categories}
          categoriesLoading={categoriesLoading}
          initialSyncKey={`onboarding-salon-${salonFormInstance}`}
          initialValues={null}
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
          footerActions={
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-full"
              disabled={createOrgSubmitting}
              onClick={() => {
                setFormError(null);
                setCreateSalonOpen(false);
              }}
            >
              {t("createSalonClose")}
            </Button>
          }
        />
      : null}
    </section>
  );
}
