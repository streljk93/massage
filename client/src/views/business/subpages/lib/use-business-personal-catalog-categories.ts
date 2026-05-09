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
  specialistsCabinetGetSpecialistOnboarding,
} from "@/shared/api";

const ONBOARDING_PAYLOAD_QK_ROOT = ["specialistOnboarding"] as const;

/**
 * Тот же набор больших категорий и рубрик, что на шаге навыков онбординга,
 * но для экранов ЛК без провайдера визарда. Дублирует ключ запроса
 * {@link SpecialistOnboardingProvider} для кэша.
 */
export function useBusinessPersonalServiceCatalogCategories(enabled: boolean) {
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const onboardQuery = useQuery({
    queryKey: [...ONBOARDING_PAYLOAD_QK_ROOT, accessToken, locale] as const,
    enabled:
      enabled && status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistOnboarding({
        client: sdk,
        query: { locale },
      });
      if (error || !data) {
        throw new Error("specialist onboarding payload");
      }
      return data;
    },
  });

  const cabSpec = onboardQuery.data?.specialist as
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
      onboardQuery.isSuccess,
    queryFn: async (): Promise<SpecialistOnboardingCatalogCategoriesData> => {
      return fetchPersonalCatalogCategoriesForCabinet(
        sdk,
        locale,
        resolvedCatalog,
      );
    },
  });

  const awaitingOnboardPayload =
    status === "authenticated" &&
    accessToken.length > 0 &&
    (onboardQuery.isPending || onboardQuery.isFetching);

  const awaitingCatalogSlice =
    onboardQuery.isSuccess &&
    (catalogQuery.isPending || catalogQuery.isFetching);

  /** Пока нет ответа `/onboarding`, не показываем пустой каталог как ошибку конфигурации. */
  const isLoading =
    enabled && (awaitingOnboardPayload || awaitingCatalogSlice);

  return {
    data: catalogQuery.data,
    isLoading,
    isError: onboardQuery.isError || catalogQuery.isError,
    refetch: () =>
      Promise.all([onboardQuery.refetch(), catalogQuery.refetch()]).then(
        () => undefined,
      ),
    workplaceMajorsEmpty: resolvedCatalog.workplaceMajorsEmpty,
    specialist: cabSpec ?? null,
  };
}
