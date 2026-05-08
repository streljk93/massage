"use client";

/* eslint-disable react-hooks/set-state-in-effect -- превью фото и сброс по initialSyncKey */

import { MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Client } from "@/shared/api/generated/sdk/client";
import type { OrganizationsCabinetPostCreateOrganizationData } from "@/shared/api/generated/sdk/types.gen";
import type { AppLocale } from "@/app/i18n/routing";
import {
  Button,
  Checkbox,
  ImageMediaDropzone,
  Input,
  ORG_SALON_GALLERY_MAX_FILES,
} from "@/shared/ui";
import { catalogGetMajorCategories } from "@/shared/api";
import { cn, previewSrcForPersistedGalleryUrl, randomUuid } from "@/shared/lib";
import { AddressMapPickerDialog } from "@/widgets/address-map-picker";
import { OrgContactFields } from "./org-contact-fields";
import { validateOrgContactForSubmit } from "../lib/organization-contact-form";

export type OrganizationSalonCabinetSubmitBody =
  OrganizationsCabinetPostCreateOrganizationData["body"];

export type OrganizationSalonCabinetFormInitialValues = {
  name: string;
  description: string;
  addrQ: string;
  /**
   * JSON после выбора на карте: `{ p, i, lat?, lng?, city? }`.
   * Если есть `lat`/`lng` — при сабмите уходят вместе с `placeReference`, координаты сохраняются без повторного resolve на сервере.
   */
  placePicked: string | null;
  legacyCoordinates: {
    addressLine: string;
    latitude: number;
    longitude: number;
    city: string | null;
  } | null;
  phoneLocal: string;
  email: string;
  website: string;
  years: string;
  majorCategorySlugs: string[];
  gallery: Array<{ url: string; alt?: string | null }>;
};

type GalleryRow =
  | {
      kind: "remote";
      id: string;
      url: string;
      previewUrl: string;
      name: string;
    }
  | {
      kind: "local";
      id: string;
      file: File;
      previewUrl: string;
      name: string;
    };

/** Данные из «Подтвердить» в диалоге карты — сериализуются в `placePicked`. */
export type CabinetMapPlacePayload = {
  p: string;
  i: string;
  lat?: number;
  lng?: number;
  city?: string | null;
};

function parseCabinetMapPlacePayload(raw: string): CabinetMapPlacePayload | null {
  try {
    const o = JSON.parse(raw) as CabinetMapPlacePayload;
    if (typeof o.p !== "string" || typeof o.i !== "string" || !o.p || !o.i) {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

function galleryRowFromRemote(url: string, alt: string | null | undefined, idx: number): GalleryRow {
  const slug = url.split("/").pop() ?? `photo-${idx}`;
  const name = slug.length > 0 ? slug : `photo-${idx}`;
  return {
    kind: "remote",
    id: `remote:${url}:${idx}`,
    url,
    previewUrl: previewSrcForPersistedGalleryUrl(url),
    name,
  };
}

export type OrganizationSalonCabinetFormProps = {
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  client: Client;
  locale: AppLocale;
  /** Access token для react-query ключей каталога (как у client). */
  catalogQueryAccessToken: string;
  /** Ключ для полного сброса состояния: `"create"` или id организации */
  initialSyncKey: string;
  initialValues?: OrganizationSalonCabinetFormInitialValues | null;
  formError: string | null;
  onClearFormError: () => void;
  /** Показываем текст ошибки валидации/загрузки до вызова API */
  reportError: (message: string) => void;
  submitting: boolean;
  submitLabel: string;
  uploadPublicFile: (file: File) => Promise<string>;
  onSubmit: (body: OrganizationSalonCabinetSubmitBody) => void | Promise<void>;
  /** Обернуть блок в ту же карточку, что на странице создания */
  showFormCard?: boolean;
  /** Заголовок над полями (напр. создание салона в кабинете) */
  sectionTitle?: string;
  sectionHint?: string;
  footerActions?: React.ReactNode;
  className?: string;
  /** Не показывать выбор больших категорий (уже задан снаружи, например в онбординге мастера). */
  hideMajorCategoryPicker?: boolean;
};

export function OrganizationSalonCabinetForm({
  t,
  client,
  locale,
  catalogQueryAccessToken,
  initialSyncKey,
  initialValues,
  formError,
  onClearFormError,
  reportError,
  submitting,
  submitLabel,
  uploadPublicFile,
  onSubmit,
  showFormCard = true,
  sectionTitle,
  sectionHint,
  footerActions,
  className,
  hideMajorCategoryPicker = false,
}: OrganizationSalonCabinetFormProps) {
  const [name, setName] = useState("");
  const [addrQ, setAddrQ] = useState("");
  const [placePicked, setPlacePicked] = useState<string | null>(null);
  const [legacyCoordinates, setLegacyCoordinates] =
    useState<OrganizationSalonCabinetFormInitialValues["legacyCoordinates"]>(null);
  const [orgAddressMapOpen, setOrgAddressMapOpen] = useState(false);
  const [orgAddressMapNonce, setOrgAddressMapNonce] = useState(0);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [years, setYears] = useState("");
  const [majorCategorySlugs, setMajorCategorySlugs] = useState<Set<string>>(new Set());
  const [galleryRows, setGalleryRows] = useState<GalleryRow[]>([]);
  const galleryRowsRef = useRef<GalleryRow[]>([]);
  useEffect(() => {
    galleryRowsRef.current = galleryRows;
  }, [galleryRows]);

  const majorsQuery = useQuery({
    queryKey: ["organizationCabinetMajorCategories", locale, catalogQueryAccessToken] as const,
    enabled: catalogQueryAccessToken.length > 0 && !hideMajorCategoryPicker,
    queryFn: async () => {
      const { data, error } = await catalogGetMajorCategories({
        client,
        query: { locale },
      });
      if (error || !data?.majorCategories) {
        throw new Error("major-categories");
      }
      return [...data.majorCategories].sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
    },
  });

  const applySync = useCallback(() => {
    galleryRowsRef.current.forEach((row) => {
      if (row.kind === "local") {
        URL.revokeObjectURL(row.previewUrl);
      }
    });
    if (!initialValues) {
      setName("");
      setAddrQ("");
      setPlacePicked(null);
      setLegacyCoordinates(null);
      setPhoneLocal("");
      setEmail("");
      setWebsite("");
      setDescription("");
      setYears("");
      setGalleryRows([]);
      setMajorCategorySlugs(new Set());
      return;
    }
    setName(initialValues.name);
    setAddrQ(initialValues.addrQ);
    setPlacePicked(initialValues.placePicked);
    setLegacyCoordinates(initialValues.legacyCoordinates);
    setPhoneLocal(initialValues.phoneLocal);
    setEmail(initialValues.email);
    setWebsite(initialValues.website);
    setDescription(initialValues.description);
    setYears(initialValues.years);
    setMajorCategorySlugs(new Set(initialValues.majorCategorySlugs ?? []));
    setGalleryRows(
      initialValues.gallery.map((g, idx) =>
        galleryRowFromRemote(g.url, g.alt ?? null, idx),
      ),
    );
  }, [initialValues]);

  useEffect(() => {
    applySync();
  }, [initialSyncKey, applySync]);

  useEffect(() => {
    return () => {
      galleryRowsRef.current.forEach((row) => {
        if (row.kind === "local") {
          URL.revokeObjectURL(row.previewUrl);
        }
      });
    };
  }, []);

  const addLocalFiles = useCallback((files: File[]) => {
    setGalleryRows((prev) => {
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
          kind: "local",
          id: randomUuid(),
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
        });
      }
      return next;
    });
  }, []);

  const removeGalleryRow = useCallback((id: string) => {
    setGalleryRows((prev) => {
      const row = prev.find((x) => x.id === id);
      if (row?.kind === "local") {
        URL.revokeObjectURL(row.previewUrl);
      }
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const runSubmit = async () => {
    if (!name.trim()) {
      reportError(t("vErrCreateOrgRequired"));
      return;
    }

    let placeReference: OrganizationSalonCabinetSubmitBody["placeReference"] | undefined;
    let addressLineLegacy: string | undefined;
    let cityLegacy: string | null | undefined;
    let latLegacy: number | undefined;
    let lngLegacy: number | undefined;
    /** Вместе с `placeReference`: точка с маркера карты кабинета (без серверного resolve координат). */
    let mapPinCoords:
      | { addressLine: string; city: string | null | undefined; latitude: number; longitude: number }
      | undefined;

    if (placePicked != null && placePicked.trim().length > 0) {
      const parsed = parseCabinetMapPlacePayload(placePicked.trim());
      if (parsed != null) {
        placeReference = {
          provider: parsed.p as NonNullable<
            OrganizationSalonCabinetSubmitBody["placeReference"]
          >["provider"],
          placeId: parsed.i,
        };
        const plat = parsed.lat;
        const plng = parsed.lng;
        if (
          plat != null &&
          plng != null &&
          Number.isFinite(plat) &&
          Number.isFinite(plng)
        ) {
          const line = addrQ.trim();
          if (line.length < 1) {
            reportError(t("vErrCreateOrgRequired"));
            return;
          }
          mapPinCoords = {
            addressLine: line,
            city: parsed.city ?? undefined,
            latitude: plat,
            longitude: plng,
          };
        }
      }
    }

    if (placeReference == null) {
      const leg = legacyCoordinates;
      if (
        leg == null ||
        leg.addressLine.trim().length === 0 ||
        leg.latitude == null ||
        leg.longitude == null ||
        Number.isNaN(leg.latitude) ||
        Number.isNaN(leg.longitude)
      ) {
        reportError(t("vErrCreateOrgRequired"));
        return;
      }
      addressLineLegacy = leg.addressLine.trim();
      cityLegacy = leg.city;
      latLegacy = leg.latitude;
      lngLegacy = leg.longitude;
    }

    const contact = validateOrgContactForSubmit({
      phoneLocalDigits: phoneLocal,
      email,
      website,
    });
    if (!contact.ok) {
      reportError(t(contact.errorKey));
      return;
    }

    const yearsRaw = years.trim();
    const yearsParsed =
      yearsRaw === "" ? null : Math.min(80, Math.max(0, parseInt(yearsRaw, 10) || 0));

    if (hideMajorCategoryPicker && majorCategorySlugs.size < 1) {
      reportError(t("vErrCreateOrgCategories"));
      return;
    }

    const galleryUrls: string[] = [];
    try {
      for (const row of galleryRows) {
        if (row.kind === "remote") {
          galleryUrls.push(row.url);
        } else {
          const up = await uploadPublicFile(row.file);
          if (!up.trim()) {
            reportError(t("vErrPhoto"));
            return;
          }
          galleryUrls.push(up.trim());
        }
      }
    } catch {
      reportError(t("vErrPhoto"));
      return;
    }

    let imageUrl: string | null = null;
    let imageAlt: string | null = null;
    const galleryImageUrls: string[] | undefined =
      galleryUrls.length > 1 ? galleryUrls.slice(1)
      : galleryUrls.length === 1 ? undefined
      : undefined;
    if (galleryUrls.length > 0) {
      imageUrl = galleryUrls[0]!;
      imageAlt = name.trim();
    }

    const body: OrganizationSalonCabinetSubmitBody = {
      name: name.trim(),
      description: description.trim() || undefined,
      phone: contact.value.phone,
      email: contact.value.email,
      website: contact.value.website,
      yearsInBusiness: yearsParsed,
      imageUrl: imageUrl ?? null,
      imageAlt: galleryUrls.length > 0 ? imageAlt : null,
      ...(galleryImageUrls != null && galleryImageUrls.length > 0 ?
        { galleryImageUrls }
      : {}),
      serviceCategoryIds: [],
      majorCategorySlugs: Array.from(majorCategorySlugs).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
      ...(placeReference != null ?
        mapPinCoords != null ?
          {
            placeReference,
            addressLine: mapPinCoords.addressLine,
            city: mapPinCoords.city ?? undefined,
            latitude: mapPinCoords.latitude,
            longitude: mapPinCoords.longitude,
          }
        : { placeReference }
      : {
          addressLine: addressLineLegacy!,
          city: cityLegacy ?? undefined,
          latitude: latLegacy,
          longitude: lngLegacy,
        }),
    };

    await onSubmit(body);
  };

  const majorsBlocked =
    hideMajorCategoryPicker ?
      majorCategorySlugs.size < 1
    : majorsQuery.isLoading || majorsQuery.isError || majorsQuery.data == null;

  const inner = (
    <>
      {formError ?
        <p className="text-pretty text-sm text-destructive" role="alert">
          {formError}
        </p>
      : null}

      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">{t("orgPhoto")}</span>
        <p className="text-pretty text-xs text-muted-foreground">{t("orgPhotosMultiHint")}</p>
        <ImageMediaDropzone
          selectionMode="multiple"
          disabled={submitting}
          items={galleryRows.map((x) => ({
            id: x.id,
            previewUrl: x.previewUrl,
            name: x.name,
          }))}
          onAdd={addLocalFiles}
          onRemove={removeGalleryRow}
          maxFiles={ORG_SALON_GALLERY_MAX_FILES}
          title={t("uploadPhoto")}
          hint={t("uploadHint")}
          titleWhenHasItems={t("changePhoto")}
          hintWhenHasItems={t("orgPhotosAddMoreHint")}
          dropzoneAriaLabel={t("orgPhoto")}
          addMoreAriaLabel={t("orgAddMorePhotosAria")}
          removeItemAriaLabel={(n) => t("orgPhotoRemoveAria", { name: n })}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("orgName")}</span>
        <Input
          className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
          value={name}
          disabled={submitting}
          onChange={(e) => setName(e.target.value)}
          autoComplete="organization"
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-foreground" id="org-address-label">
          {t("orgAddress")}
        </span>
        <p className="text-pretty text-xs text-muted-foreground">{t("orgFormAddressMapHint")}</p>
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full gap-2 rounded-2xl border-0 shadow-none"
          disabled={submitting}
          aria-labelledby="org-address-label"
          onClick={() => {
            onClearFormError();
            setOrgAddressMapNonce((n) => n + 1);
            setOrgAddressMapOpen(true);
          }}
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          {t("orgFormPickOnMap")}
        </Button>
        {addrQ.trim().length > 0 ?
          <div className="rounded-2xl bg-muted/25 px-3 py-2.5 ring-1 ring-inset ring-border/30">
            <p className="text-xs font-medium text-muted-foreground">{t("orgFormAddressSelected")}</p>
            <p className="mt-0.5 text-sm text-foreground">{addrQ}</p>
          </div>
        : null}
      </div>
      <OrgContactFields
        phoneLocal={phoneLocal}
        setPhoneLocal={setPhoneLocal}
        email={email}
        setEmail={setEmail}
        website={website}
        setWebsite={setWebsite}
        disabled={submitting}
        t={t}
      />
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("orgFormYears")}</span>
        <Input
          className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
          value={years}
          disabled={submitting}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
            setYears(v);
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
          value={description}
          disabled={submitting}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {hideMajorCategoryPicker ? null : (
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("orgFormActivityAreas")}</span>
          <p className="text-pretty text-xs text-muted-foreground">{t("orgFormActivityAreasHint")}</p>
          {majorsQuery.isLoading ?
            <div className="h-24 animate-pulse rounded-xl bg-muted/40" aria-busy />
          : majorsQuery.isError ?
            <p className="text-pretty text-sm text-destructive" role="alert">
              {t("vErrCatalogCategories")}
            </p>
          : (majorsQuery.data?.length ?? 0) === 0 ?
            <p className="text-pretty text-sm text-muted-foreground">{t("orgFormActivityAreasEmptyCatalog")}</p>
          : <div className="flex flex-col gap-2">
              {majorsQuery.data!.map((m) => {
                const checked = majorCategorySlugs.has(m.slug);
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={submitting}
                      onCheckedChange={() => {
                        setMajorCategorySlugs((prev) => {
                          const n = new Set(prev);
                          if (n.has(m.slug)) {
                            n.delete(m.slug);
                          } else {
                            n.add(m.slug);
                          }
                          return n;
                        });
                      }}
                    />
                    <span className="text-sm">{m.name}</span>
                  </label>
                );
              })}
            </div>
          }
        </div>
      )}

      <div
        className={cn(
          "flex gap-2 pt-1",
          footerActions ?
            "flex-col"
          : "flex-col sm:flex-row sm:justify-end",
        )}
      >
        {footerActions}
        <Button
          type="button"
          variant="primary"
          className="h-12 w-full rounded-full sm:min-w-40"
          disabled={submitting || majorsBlocked}
          onClick={() => void runSubmit()}
        >
          {submitting ? t("saving") : submitLabel}
        </Button>
      </div>
    </>
  );

  const body = (
    <>
      {sectionTitle ?
        <>
          <h2 className="font-heading text-lg font-semibold text-foreground">{sectionTitle}</h2>
          {sectionHint ?
            <p className="text-pretty text-sm text-muted-foreground">{sectionHint}</p>
          : null}
        </>
      : sectionHint ?
        <p className="text-pretty text-sm text-muted-foreground">{sectionHint}</p>
      : null}
      {inner}
    </>
  );

  return (
    <>
      <div className={cn(showFormCard && "space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4", className)}>
        {body}
      </div>

      <AddressMapPickerDialog
        key={orgAddressMapNonce}
        open={orgAddressMapOpen}
        onOpenChange={setOrgAddressMapOpen}
        client={client}
        locale={locale}
        onPick={(r) => {
          setAddrQ(r.addressLine);
          setPlacePicked(
            JSON.stringify({
              p: r.sourceProvider,
              i: r.sourceReference,
              lat: r.latitude,
              lng: r.longitude,
              city: r.city,
            }),
          );
          setLegacyCoordinates(null);
        }}
      />
    </>
  );
}
