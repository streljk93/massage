"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import type { ServiceCategorySkillSection } from "@/entities/services";
import { ServiceCategorySkillsPicker } from "@/entities/services";
import { invalidateSpecialistCabinetProfileQueries } from "@/entities/specialists";
import {
  createBrowserSdkClient,
  specialistsCabinetPatchSpecialistCabinetSkills,
} from "@/shared/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import { useBusinessPersonalServiceCatalogCategories } from "../lib/use-business-personal-catalog-categories";

const ONB_QK = ["specialistOnboarding"] as const;

function sortedIdsJson(ids: readonly string[]): string {
  return [...ids].map((x) => x.trim()).filter(Boolean).sort().join("\u0001");
}

export function BusinessSkillsPage() {
  const t = useTranslations("businessSkillsPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const catalogBundle = useBusinessPersonalServiceCatalogCategories(
    sessionStatus === "authenticated" && accessToken.length > 0,
  );

  const specialist = catalogBundle.specialist;
  const serverIds = useMemo(() => {
    const raw = (
      specialist as { skillServiceCategoryIds?: unknown } | null | undefined
    )?.skillServiceCategoryIds;
    if (!Array.isArray(raw)) {
      return [] as string[];
    }
    return raw.filter((x): x is string => typeof x === "string");
  }, [specialist]);

  const serverKey = useMemo(() => sortedIdsJson(serverIds), [serverIds]);

  const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setDraftIds(new Set(serverIds));
  }, [serverKey]);

  const dirty =
    sortedIdsJson(serverIds) !==
    sortedIdsJson([...draftIds].filter((x) => x.trim().length > 0));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await specialistsCabinetPatchSpecialistCabinetSkills({
        client: sdk,
        query: { locale },
        body: { serviceCategoryIds: [...draftIds] },
      });
      if (error) {
        throw new Error("save");
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...ONB_QK, accessToken, locale] as const,
        }),
        invalidateSpecialistCabinetProfileQueries(
          queryClient,
          accessToken,
          locale,
        ),
      ]);
    },
  });

  const majors = catalogBundle.data?.majors ?? [];
  const categories = catalogBundle.data?.categories ?? [];

  const sections: ServiceCategorySkillSection[] = useMemo(() => {
    const majorNameBySlug = new Map(majors.map((m) => [m.slug, m.name]));
    const byMajor = new Map<
      string,
      Array<{ categoryId: string; name: string }>
    >();
    for (const c of categories) {
      const list = byMajor.get(c.majorSlug) ?? [];
      list.push({ categoryId: c.id, name: c.label });
      byMajor.set(c.majorSlug, list);
    }
    return [...byMajor.entries()].map(([majorSlug, items]) => ({
      majorSlug,
      majorName: majorNameBySlug.get(majorSlug) ?? majorSlug,
      items: [...items].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    }));
  }, [majors, categories]);

  function toggle(id: string) {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const workplaceMajorsEmpty = catalogBundle.workplaceMajorsEmpty;

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-4 px-4 pt-2">
      {sessionStatus === "loading" || (sessionStatus === "authenticated" && accessToken.length === 0) ?
        <div
          className="flex justify-center py-12 text-muted-foreground"
          aria-busy
          aria-label={t("loadingAria")}
        >
          <Loader2 className="size-8 animate-spin" aria-hidden />
        </div>
      : sessionStatus === "unauthenticated" || !accessToken ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("signInTitle")}
          description={t("signInHint")}
        />
      : catalogBundle.isError ?
        <div className="flex flex-col gap-3">
          <BusinessEmptyState
            icon={UsersRound}
            title={t("loadErrorTitle")}
            description={t("loadErrorHint")}
          />
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-2xl"
            onClick={() => void catalogBundle.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      : specialist == null ?
        <BusinessEmptyState
          icon={UsersRound}
          title={t("emptyProfileTitle")}
          description={t("emptyProfileHint")}
        />
      : workplaceMajorsEmpty ?
        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {t("workplaceMajorsEmptyTitle")}
          </h2>
          <p className="text-pretty text-sm text-muted-foreground">
            {t("workplaceMajorsEmptyHint")}
          </p>
        </section>
      : <>
          <p className="text-pretty text-[0.9375rem] text-muted-foreground">
            {t("subtitle")}
          </p>
          <p className="text-pretty text-sm text-muted-foreground">{t("hint")}</p>
          {catalogBundle.isLoading ?
            <div
              className="flex justify-center py-12 text-muted-foreground"
              aria-busy
              aria-label={t("loadingAria")}
            >
              <Loader2 className="size-8 animate-spin" aria-hidden />
            </div>
          : <ServiceCategorySkillsPicker
              sections={sections}
              selectedIds={draftIds}
              onToggle={toggle}
              disabled={saveMutation.isPending}
              groupAriaLabel={(name) => t("pickerGroupAria", { name })}
              optionAriaLabel={(name) => t("pickerOptionAria", { name })}
            />
          }
          {saveMutation.isError ?
            <p className="text-sm text-destructive" role="alert">
              {t("saveError")}
            </p>
          : null}
          <Button
            type="button"
            className="h-12 w-full rounded-2xl"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => void saveMutation.mutateAsync()}
          >
            {saveMutation.isPending ? t("saving") : t("save")}
          </Button>
        </>
      }
    </main>
  );
}
