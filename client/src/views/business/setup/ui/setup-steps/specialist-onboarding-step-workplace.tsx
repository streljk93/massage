"use client";

import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { AddressMapPickerDialog } from "@/widgets/address-map-picker";
import {
  AvatarPhotoDropzone,
  Button,
  Checkbox,
  Input,
  SearchAutocomplete,
} from "@/shared/ui";
import { useSpecialistOnboardingCatalogCategories } from "../../lib/use-specialist-onboarding-catalog-categories";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepWorkplace() {
  const t = useTranslations("specialistOnboarding");
  const { data: categories = [], isLoading: categoriesLoading } =
    useSpecialistOnboardingCatalogCategories(true);
  const {
    locale,
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
    setFormError,
    newOrgName,
    setNewOrgName,
    newOrgAddrQ,
    newOrgPhone,
    setNewOrgPhone,
    newOrgEmail,
    setNewOrgEmail,
    newOrgWebsite,
    setNewOrgWebsite,
    newOrgDescription,
    setNewOrgDescription,
    newOrgYears,
    setNewOrgYears,
    newOrgCategoryIds,
    setNewOrgCategoryIds,
    setNewOrgAddrQ,
    setNewOrgPlacePicked,
    pendingOrgPhotoFile,
    pendingOrgPhotoObjectUrl,
    setPendingOrgPhotoFile,
    orgAddressMapOpen,
    setOrgAddressMapOpen,
    orgAddressMapNonce,
    setOrgAddressMapNonce,
    onCreateSalonSubmit,
    resetCreateSalonForm,
  } = useSpecialistOnboarding();

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t("step4Title")}
      </h1>
      <p className="text-pretty text-[0.9375rem] text-muted-foreground">
        {t("step4Sub")}
      </p>
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
          minQueryLength={2}
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
            if (newOrgCategoryIds.size === 0 && categories[0]) {
              setNewOrgCategoryIds(new Set([categories[0]!.id]));
            }
            setCreateSalonOpen(true);
          }}
        >
          {t("addOrgCta")}
        </Button>
      </div>
      {createSalonOpen ? (
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {t("orgFormTitle")}
          </h2>
          <p className="text-pretty text-sm text-muted-foreground">{t("orgFormHint")}</p>
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">{t("orgPhoto")}</span>
            <AvatarPhotoDropzone
              disabled={createOrgSubmitting}
              title={t("uploadPhoto")}
              hint={t("uploadHint")}
              dropzoneAriaLabel={t("orgPhoto")}
              previewUrl={pendingOrgPhotoObjectUrl}
              fileLabel={pendingOrgPhotoFile?.name ?? null}
              titleWithPreview={t("changePhoto")}
              hintWithPreview={t("photoReplaceHint")}
              onFileChosen={(file) => setPendingOrgPhotoFile(file)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("orgName")}</span>
            <Input
              className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
              value={newOrgName}
              disabled={createOrgSubmitting}
              onChange={(e) => setNewOrgName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <span
              className="text-sm font-medium text-foreground"
              id="new-org-address-label"
            >
              {t("orgAddress")}
            </span>
            <p className="text-pretty text-xs text-muted-foreground">
              {t("orgFormAddressMapHint")}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full gap-2 rounded-2xl border-0 shadow-none"
              disabled={createOrgSubmitting}
              aria-labelledby="new-org-address-label"
              onClick={() => {
                setFormError(null);
                setOrgAddressMapNonce((n) => n + 1);
                setOrgAddressMapOpen(true);
              }}
            >
              <MapPin className="size-4 shrink-0" aria-hidden />
              {t("orgFormPickOnMap")}
            </Button>
            {newOrgAddrQ.trim().length > 0 ? (
              <div className="rounded-2xl bg-muted/25 px-3 py-2.5 ring-1 ring-inset ring-border/30">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("orgFormAddressSelected")}
                </p>
                <p className="mt-0.5 text-sm text-foreground">{newOrgAddrQ}</p>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("orgFormPhone")}</span>
            <Input
              className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
              value={newOrgPhone}
              disabled={createOrgSubmitting}
              onChange={(e) => setNewOrgPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("orgFormEmail")}</span>
            <Input
              className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
              value={newOrgEmail}
              disabled={createOrgSubmitting}
              onChange={(e) => setNewOrgEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("orgFormWebsite")}</span>
            <Input
              className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
              value={newOrgWebsite}
              disabled={createOrgSubmitting}
              onChange={(e) => setNewOrgWebsite(e.target.value)}
              type="url"
              inputMode="url"
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("orgFormYears")}</span>
            <Input
              className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
              value={newOrgYears}
              disabled={createOrgSubmitting}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                setNewOrgYears(v);
              }}
              inputMode="numeric"
              placeholder="0–80"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("orgFormDescription")}</span>
            <textarea
              className="w-full min-h-20 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              rows={3}
              value={newOrgDescription}
              disabled={createOrgSubmitting}
              onChange={(e) => setNewOrgDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("orgFormCategories")}</span>
            <div className="flex flex-col gap-2">
              {categories.map((c) => {
                const checked = newOrgCategoryIds.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={createOrgSubmitting}
                      onCheckedChange={() => {
                        setNewOrgCategoryIds((prev) => {
                          const n = new Set(prev);
                          if (n.has(c.id)) {
                            n.delete(c.id);
                          } else {
                            n.add(c.id);
                          }
                          return n;
                        });
                      }}
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-full sm:w-auto"
              disabled={createOrgSubmitting}
              onClick={() => {
                setFormError(null);
                resetCreateSalonForm();
                setCreateSalonOpen(false);
              }}
            >
              {t("createSalonClose")}
            </Button>
            <Button
              type="button"
              className="h-12 w-full rounded-full sm:min-w-40"
              disabled={createOrgSubmitting}
              onClick={() => {
                void onCreateSalonSubmit();
              }}
            >
              {createOrgSubmitting ? t("saving") : t("createSalonSubmit")}
            </Button>
          </div>
        </div>
      ) : null}
      {createSalonOpen ? (
        <AddressMapPickerDialog
          key={orgAddressMapNonce}
          open={orgAddressMapOpen}
          onOpenChange={setOrgAddressMapOpen}
          client={sdk}
          locale={locale}
          onPick={(r) => {
            setNewOrgAddrQ(r.addressLine);
            setNewOrgPlacePicked(
              JSON.stringify({ p: r.sourceProvider, i: r.sourceReference }),
            );
          }}
        />
      ) : null}
    </section>
  );
}
