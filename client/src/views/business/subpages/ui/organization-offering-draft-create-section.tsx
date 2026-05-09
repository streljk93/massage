"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { useTranslations } from "next-intl";
import type { AppLocale } from "@/app/i18n/routing";
import {
  catalogGetBulkCategoriesByMajorSlugs,
  createBrowserSdkClient,
  organizationOfferingsCabinetCreateDraft,
} from "@/shared/api";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const OFFERINGS_QK = ["organizationOfferingsCabinet"] as const;

export const OFFERING_DRAFT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyOfferingDraftTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Props = {
  organizationId: string;
  sdk: ReturnType<typeof createBrowserSdkClient>;
  locale: AppLocale;
  majorCategorySlugs: readonly string[] | undefined;
  t: ReturnType<typeof useTranslations<"businessOrganizationOfferingsPage">>;
};

export function OrganizationOfferingDraftCreateSection({
  organizationId,
  sdk,
  locale,
  majorCategorySlugs,
  t,
}: Props) {
  const queryClient = useQueryClient();

  const majorSlugsCsv = useMemo(
    () =>
      majorCategorySlugs
        ?.filter((s) => s.trim().length > 0)
        .join(",")
        ?.trim() ?? "",
    [majorCategorySlugs],
  );

  const catalogQuery = useQuery({
    queryKey: ["catalogBulkCategories", majorSlugsCsv, locale] as const,
    enabled: majorSlugsCsv.length > 0,
    queryFn: async () => {
      const { data, error } = await catalogGetBulkCategoriesByMajorSlugs({
        client: sdk,
        query: {
          majorSlugs: majorSlugsCsv,
          locale,
        },
      });
      if (error || !data) {
        throw error ?? new Error("catalog");
      }
      return data;
    },
  });

  const flatCategories = useMemo(() => {
    const sections = catalogQuery.data?.sections ?? [];
    const rows: { id: string; label: string }[] = [];
    for (const sec of sections) {
      for (const c of sec.categories) {
        rows.push({
          id: c.id,
          label: `${sec.majorCategory.name} — ${c.name}`,
        });
      }
    }
    return rows;
  }, [catalogQuery.data?.sections]);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const createDraftMut = useMutation({
    mutationFn: async () => {
      const slug = draftSlug.trim().toLowerCase();
      if (!OFFERING_DRAFT_SLUG_RE.test(slug)) {
        throw new Error("slug");
      }
      const { error } = await organizationOfferingsCabinetCreateDraft({
        client: sdk,
        path: { organizationId },
        body: {
          title: draftTitle.trim(),
          slug,
          categoryId: draftCategoryId.trim(),
          description: draftDescription.trim() || null,
        },
      });
      if (error) throw new Error("draft");
    },
    onSuccess: () => {
      setDraftTitle("");
      setDraftSlug("");
      setDraftCategoryId("");
      setDraftDescription("");
      void queryClient.invalidateQueries({ queryKey: OFFERINGS_QK });
    },
  });

  const majorsMissing = majorSlugsCsv.length === 0;
  const catalogLoading = majorSlugsCsv.length > 0 && catalogQuery.isPending;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <h2 className="font-heading text-sm font-semibold">{t("draftSectionTitle")}</h2>

      {majorsMissing ?
        <div
          className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
          aria-live="polite"
        >
          <p className="font-heading text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t("majorsMissingTitle")}
          </p>
          <p className="mt-1 text-pretty text-xs leading-snug text-amber-950/80 dark:text-amber-100/90">
            {t("majorsMissingHint")}
          </p>
        </div>
      : null}

      {catalogLoading ?
        <div className="mt-3 h-28 animate-pulse rounded-xl bg-muted/50" aria-busy />
      : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="draft-title">
              {t("fieldTitle")}
            </label>
            <Input
              id="draft-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => {
                if (draftSlug.trim().length === 0 && draftTitle.trim().length > 0) {
                  const s = slugifyOfferingDraftTitle(draftTitle);
                  if (s.length > 0) {
                    setDraftSlug(s);
                  }
                }
              }}
              className="rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="draft-slug">
              {t("fieldSlug")}
            </label>
            <Input
              id="draft-slug"
              value={draftSlug}
              onChange={(e) => setDraftSlug(e.target.value.toLowerCase())}
              className="rounded-xl"
              disabled={majorsMissing}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("fieldCategory")}</span>
            <Select
              value={draftCategoryId}
              onValueChange={setDraftCategoryId}
              disabled={majorsMissing || flatCategories.length === 0}
            >
              <SelectTrigger className="rounded-xl" id="draft-category">
                <SelectValue placeholder={t("fieldCategoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {flatCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="draft-desc">
              {t("fieldDescription")}
            </label>
            <Textarea
              id="draft-desc"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              className="min-h-[4.5rem] rounded-xl"
            />
          </div>
          <Button
            type="button"
            className="rounded-xl"
            disabled={
              createDraftMut.isPending ||
              majorsMissing ||
              catalogLoading ||
              draftTitle.trim().length === 0 ||
              !OFFERING_DRAFT_SLUG_RE.test(draftSlug.trim().toLowerCase()) ||
              draftCategoryId.trim().length === 0
            }
            onClick={() => void createDraftMut.mutate()}
          >
            {createDraftMut.isPending ?
              <Loader2 className="size-4 animate-spin" aria-hidden />
            : t("createDraft")}
          </Button>
        </div>
      )}
    </section>
  );
}
