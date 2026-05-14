"use client";

import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  fetchPersonalCatalogCategoriesForCabinet,
  resolvePersonalCatalogQueryFromSpec,
} from "@/views/business/setup/lib/personal-catalog-categories-core";
import type {
  PersonalCatalogMajorSourceSpec,
  SpecialistOnboardingCatalogCategoriesData,
} from "@/views/business/setup/lib/personal-catalog-categories-core";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistCabinetProfile,
} from "@/shared/api";

const CABINET_PROFILE_QK_ROOT = ["specialistCabinetProfile"] as const;

/**
 * Тот же набор больших категорий и рубрик, что на шаге навыков онбординга,
 * но для экранов ЛК без провайдера визарда. Дублирует ключ запроса
 * `GET /specialists/me/cabinet-profile` для кэша.
 */
export function useBusinessPersonalServiceCatalogCategories(enabled: boolean) {
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const cabinetProfileQuery = useQuery({
    queryKey: [...CABINET_PROFILE_QK_ROOT, accessToken, locale] as const,
    enabled:
      enabled && status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistCabinetProfile({
        client: sdk,
        query: { locale },
      });
      if (error || !data) {
        throw new Error("specialist cabinet profile payload");
      }
      return data;
    },
  });

  const cabSpec = cabinetProfileQuery.data?.specialist as
    | PersonalCatalogMajorSourceSpec
    | null
    | undefined;

  const resolvedCatalog = resolvePersonalCatalogQueryFromSpec(cabSpec);

  const catalogQuery = useQuery({
    queryKey: [
      "businessPersonalServiceCatalogCategories",
      resolvedCatalog.cacheKeySuffix,
      locale,
    ] as const,
    enabled:
      enabled &&
      status === "authenticated" &&
      accessToken.length > 0 &&
      cabinetProfileQuery.isSuccess,
    queryFn: async (): Promise<SpecialistOnboardingCatalogCategoriesData> => {
      return fetchPersonalCatalogCategoriesForCabinet(
        sdk,
        locale,
        resolvedCatalog,
      );
    },
  });

  const awaitingCabinetPayload =
    status === "authenticated" &&
    accessToken.length > 0 &&
    (cabinetProfileQuery.isPending || cabinetProfileQuery.isFetching);

  const awaitingCatalogSlice =
    cabinetProfileQuery.isSuccess &&
    (catalogQuery.isPending || catalogQuery.isFetching);

  /** Пока нет ответа `cabinet-profile`, не показываем пустой каталог как ошибку конфигурации. */
  const isLoading =
    enabled && (awaitingCabinetPayload || awaitingCatalogSlice);

  return {
    data: catalogQuery.data,
    isLoading,
    isError: cabinetProfileQuery.isError || catalogQuery.isError,
    refetch: () =>
      Promise.all([
        cabinetProfileQuery.refetch(),
        catalogQuery.refetch(),
      ]).then(() => undefined),
    workplaceMajorsEmpty: resolvedCatalog.workplaceMajorsEmpty,
    specialist: cabSpec ?? null,
  };
}
