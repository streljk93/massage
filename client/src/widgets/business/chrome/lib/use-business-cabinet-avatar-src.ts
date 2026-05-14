"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import type { AppLocale } from "@/app/i18n/routing";
import { SPECIALIST_CABINET_PROFILE_QK } from "@/entities/specialists";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistCabinetProfile,
} from "@/shared/api";
import { resolveApiResourceUrl } from "@/shared/lib";

function vitrineImageFromCabinetSpecialist(
  specialist: unknown,
): string | undefined {
  if (specialist == null || typeof specialist !== "object") {
    return undefined;
  }
  const raw = (specialist as { imageUrl?: unknown }).imageUrl;
  if (typeof raw !== "string" || !raw.trim()) {
    return undefined;
  }
  return resolveApiResourceUrl(raw.trim());
}

/**
 * URL аватара в шапке/дровере бизнес-кабинета: витринное фото мастера, иначе из сессии (OAuth / User).
 */
export function useBusinessCabinetAvatarSrc(): string | undefined {
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";

  const { data: cabinet } = useQuery({
    queryKey: [...SPECIALIST_CABINET_PROFILE_QK, accessToken, locale] as const,
    enabled: status === "authenticated" && accessToken.length > 0,
    queryFn: async () => {
      const { data, error } = await specialistsCabinetGetSpecialistCabinetProfile({
        client: createBrowserSdkClient(accessToken, { locale }),
        query: { locale },
      });
      if (error || !data) {
        throw new Error("cabinet-profile");
      }
      return data;
    },
  });

  return useMemo(() => {
    const fromSpec = vitrineImageFromCabinetSpecialist(cabinet?.specialist);
    if (fromSpec) {
      return fromSpec;
    }
    const img = session?.user?.image;
    return typeof img === "string" && img.length > 0 ? img : undefined;
  }, [cabinet?.specialist, session?.user?.image]);
}
