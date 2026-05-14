import type { QueryClient } from "@tanstack/react-query";
import type { AppLocale } from "@/app/i18n/routing";
import { SPECIALIST_CABINET_PROFILE_QK } from "./specialist-cabinet-profile-query-key";

export function invalidateSpecialistCabinetProfileQueries(
  queryClient: QueryClient,
  accessToken: string,
  locale: AppLocale,
) {
  return queryClient.invalidateQueries({
    queryKey: [...SPECIALIST_CABINET_PROFILE_QK, accessToken, locale],
  });
}
