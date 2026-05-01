"use client";

import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createBrowserSdkClient,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import { specialistMyOrganizationsQueryKey } from "../lib/specialist-my-organizations";

export function useSpecialistMyOrganizationsQuery(options: { enabled: boolean }) {
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const enabled =
    options.enabled &&
    status === "authenticated" &&
    typeof accessToken === "string" &&
    accessToken.length > 0;

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  return useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled,
    queryFn: async () => {
      const { data: res, error: err } = await specialistsCabinetGetSpecialistMyOrganizations({
        client: sdk,
      });
      if (err || !res) {
        throw err ?? new Error("organizations");
      }
      return res;
    },
  });
}
