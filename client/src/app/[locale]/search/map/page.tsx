import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  fetchAllOrganizationsPages,
  fetchAllSpecialistsPages,
  serverSdkFetchNoStore,
} from "@/shared/api";
import { SearchMapPageClient } from "@/views/search";

export default async function Page() {
  const locale = (await getLocale()) as AppLocale;
  const sdkClient = createServerSdkClient();
  let initialOrganizations = null;
  let initialSpecialists = null;
  if (sdkClient) {
    try {
      const [orgs, specs] = await Promise.all([
        fetchAllOrganizationsPages({
          client: sdkClient,
          locale,
          fetch: serverSdkFetchNoStore,
        }),
        fetchAllSpecialistsPages({
          client: sdkClient,
          locale,
          fetch: serverSdkFetchNoStore,
        }),
      ]);
      initialOrganizations = orgs;
      initialSpecialists = specs;
    } catch {
      initialOrganizations = null;
      initialSpecialists = null;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-surface-background" />
      }
    >
      <SearchMapPageClient
        initialOrganizations={initialOrganizations}
        initialSpecialists={initialSpecialists}
      />
    </Suspense>
  );
}
