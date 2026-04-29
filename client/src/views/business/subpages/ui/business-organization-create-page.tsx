"use client";

/* eslint-disable react-hooks/set-state-in-effect -- превью фото и выбор категории по умолчанию как в онбординге */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState, useBusinessSalonCatalogCategories } from "@/entities/business";
import {
  createBrowserSdkClient,
  filesUploadPublic,
  organizationsCabinetPostCreateOrganization,
} from "@/shared/api";
import {
  Button,
  Checkbox,
  ImageMediaDropzone,
  Input,
  ORG_SALON_GALLERY_MAX_FILES,
} from "@/shared/ui";
import { useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { AddressMapPickerDialog } from "@/widgets/address-map-picker";
import { OrgContactFields } from "@/views/business/ui/org-contact-fields";
import { validateOrgContactForSubmit } from "@/views/business/lib/organization-contact-form";

const ONB_QK = ["specialistOnboarding"] as const;
const ORGS_QK = ["specialistMyOrganizations"] as const;

type OrgCreateGalleryItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export function BusinessOrganizationCreatePage() {
  const t = useTranslations("specialistOnboarding");
  const tPage = useTranslations("businessAppSubpages");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const { data: categories = [], isLoading: categoriesLoading } =
    useBusinessSalonCatalogCategories(sessionStatus === "authenticated" && accessToken.length > 0);

  const [formError, setFormError] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgAddrQ, setNewOrgAddrQ] = useState("");
  const [newOrgPlacePicked, setNewOrgPlacePicked] = useState<string | null>(null);
  const [orgAddressMapOpen, setOrgAddressMapOpen] = useState(false);
  const [orgAddressMapNonce, setOrgAddressMapNonce] = useState(0);
  const [newOrgPhoneLocal, setNewOrgPhoneLocal] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgWebsite, setNewOrgWebsite] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [newOrgYears, setNewOrgYears] = useState("");
  const [newOrgCategoryIds, setNewOrgCategoryIds] = useState<Set<string>>(new Set());
  const [pendingOrgGallery, setPendingOrgGallery] = useState<OrgCreateGalleryItem[]>([]);
  const pendingOrgGalleryRef = useRef<OrgCreateGalleryItem[]>([]);
  useEffect(() => {
    pendingOrgGalleryRef.current = pendingOrgGallery;
  }, [pendingOrgGallery]);
  const [createOrgSubmitting, setCreateOrgSubmitting] = useState(false);

  const addPendingOrgGalleryFiles = useCallback((files: File[]) => {
    setPendingOrgGallery((prev) => {
      const room = ORG_SALON_GALLERY_MAX_FILES - prev.length;
      if (room <= 0) {
        return prev;
      }
      const imageFiles = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
      if (imageFiles.length === 0) {
        return prev;
      }
      const next = [...prev];
      for (const file of imageFiles) {
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }, []);

  const removePendingOrgGalleryItem = useCallback((id: string) => {
    setPendingOrgGallery((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  useEffect(() => {
    return () => {
      pendingOrgGalleryRef.current.forEach((x) => URL.revokeObjectURL(x.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (categories.length < 1 || categoriesLoading) {
      return;
    }
    setNewOrgCategoryIds((prev) => {
      if (prev.size > 0) {
        return prev;
      }
      return new Set([categories[0]!.id]);
    });
  }, [categories, categoriesLoading]);

  const onSubmit = async () => {
    if (!newOrgName.trim() || newOrgPlacePicked == null) {
      setFormError(t("vErrCreateOrgRequired"));
      return;
    }
    let placeRef: { provider: string; placeId: string };
    try {
      const parsed = JSON.parse(newOrgPlacePicked) as { p: string; i: string };
      if (
        typeof parsed.p !== "string" ||
        typeof parsed.i !== "string" ||
        !parsed.p ||
        !parsed.i
      ) {
        setFormError(t("vErrCreateOrgRequired"));
        return;
      }
      placeRef = { provider: parsed.p, placeId: parsed.i };
    } catch {
      setFormError(t("vErrCreateOrgRequired"));
      return;
    }
    if (newOrgCategoryIds.size < 1) {
      setFormError(t("vErrCreateOrgCategories"));
      return;
    }
    const contact = validateOrgContactForSubmit({
      phoneLocalDigits: newOrgPhoneLocal,
      email: newOrgEmail,
      website: newOrgWebsite,
    });
    if (!contact.ok) {
      setFormError(t(contact.errorKey));
      return;
    }
    setFormError(null);
    setCreateOrgSubmitting(true);
    let imageUrl: string | undefined;
    const galleryUrls: string[] = [];
    for (const item of pendingOrgGallery) {
      const up = await filesUploadPublic({
        client: sdk,
        body: { file: item.file },
      });
      if (up.error || !up.data?.url) {
        setFormError(t("vErrPhoto"));
        setCreateOrgSubmitting(false);
        return;
      }
      galleryUrls.push(up.data.url);
    }
    if (galleryUrls.length > 0) {
      imageUrl = galleryUrls[0];
    }
    const galleryImageUrls = galleryUrls.length > 1 ? galleryUrls.slice(1) : undefined;
    const yearsRaw = newOrgYears.trim();
    const yearsParsed =
      yearsRaw === "" ? null : Math.min(80, Math.max(0, parseInt(yearsRaw, 10) || 0));
    try {
      const { error } = await organizationsCabinetPostCreateOrganization({
        client: sdk,
        query: { locale },
        body: {
          name: newOrgName.trim(),
          placeReference: {
            provider: placeRef.provider as
              | "locationiq"
              | "geoapify"
              | "opencage"
              | "nominatim",
            placeId: placeRef.placeId,
          },
          description: newOrgDescription.trim() || undefined,
          phone: contact.value.phone,
          email: contact.value.email,
          website: contact.value.website,
          yearsInBusiness: yearsParsed,
          imageUrl: imageUrl ?? null,
          imageAlt: imageUrl != null ? newOrgName.trim() : null,
          ...(galleryImageUrls != null && galleryImageUrls.length > 0 ?
            { galleryImageUrls }
          : {}),
          serviceCategoryIds: Array.from(newOrgCategoryIds),
        },
      });
      if (error) {
        setFormError(t("vErrCreateOrg"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] });
      await queryClient.invalidateQueries({ queryKey: [...ORGS_QK, accessToken, locale] });
      router.replace("/business/organizations");
    } finally {
      setCreateOrgSubmitting(false);
    }
  };

  const backToOrgs = {
    href: "/business/organizations",
    ariaLabel: tPage("organizationCreateBackAria"),
  } as const;

  if (sessionStatus === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationCreateTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationCreateTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationCreateTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationCreateTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={tPage("orgsSignInTitle")}
          description={tPage("orgsSignInHint")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={tPage("organizationCreateTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={tPage("organizationCreateTitle")}
        avatarFallback="B"
        cabinetBack={backToOrgs}
      />

      {formError ?
        <p className="text-pretty text-sm text-destructive" role="alert">
          {formError}
        </p>
      : null}

      <section className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">{t("orgFormTitle")}</h2>
        <p className="text-pretty text-sm text-muted-foreground">{t("orgFormHint")}</p>
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">{t("orgPhoto")}</span>
          <p className="text-pretty text-xs text-muted-foreground">{t("orgPhotosMultiHint")}</p>
          <ImageMediaDropzone
            selectionMode="multiple"
            disabled={createOrgSubmitting}
            items={pendingOrgGallery.map((x) => ({
              id: x.id,
              previewUrl: x.previewUrl,
              name: x.file.name,
            }))}
            onAdd={addPendingOrgGalleryFiles}
            onRemove={removePendingOrgGalleryItem}
            maxFiles={ORG_SALON_GALLERY_MAX_FILES}
            title={t("uploadPhoto")}
            hint={t("uploadHint")}
            titleWhenHasItems={t("changePhoto")}
            hintWhenHasItems={t("orgPhotosAddMoreHint")}
            dropzoneAriaLabel={t("orgPhoto")}
            addMoreAriaLabel={t("orgAddMorePhotosAria")}
            removeItemAriaLabel={(name) => t("orgPhotoRemoveAria", { name })}
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
          <span className="text-sm font-medium text-foreground" id="new-org-address-label">
            {t("orgAddress")}
          </span>
          <p className="text-pretty text-xs text-muted-foreground">{t("orgFormAddressMapHint")}</p>
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
          {newOrgAddrQ.trim().length > 0 ?
            <div className="rounded-2xl bg-muted/25 px-3 py-2.5 ring-1 ring-inset ring-border/30">
              <p className="text-xs font-medium text-muted-foreground">
                {t("orgFormAddressSelected")}
              </p>
              <p className="mt-0.5 text-sm text-foreground">{newOrgAddrQ}</p>
            </div>
          : null}
        </div>
        <OrgContactFields
          phoneLocal={newOrgPhoneLocal}
          setPhoneLocal={setNewOrgPhoneLocal}
          email={newOrgEmail}
          setEmail={setNewOrgEmail}
          website={newOrgWebsite}
          setWebsite={setNewOrgWebsite}
          disabled={createOrgSubmitting}
          t={t}
        />
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
          {categoriesLoading ?
            <div className="h-24 animate-pulse rounded-xl bg-muted/40" aria-busy />
          : <div className="flex flex-col gap-2">
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
          }
        </div>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="primary"
            className="h-12 w-full rounded-full sm:min-w-40"
            disabled={createOrgSubmitting || categoriesLoading || categories.length < 1}
            onClick={() => void onSubmit()}
          >
            {createOrgSubmitting ? t("saving") : t("createSalonSubmit")}
          </Button>
        </div>
      </section>

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
    </main>
  );
}
