import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  organizationsList,
  serverSdkFetchNoStore,
  specialistsList,
} from "@/shared/api";
import { SearchPageClient } from "@/views/search";

export default async function Page() {
  const locale = (await getLocale()) as AppLocale;
  const sdkClient = createServerSdkClient();
  let initialOrganizations = null;
  let initialSpecialists = null;
  if (sdkClient) {
    const [orgRes, specRes] = await Promise.all([
      organizationsList({
        client: sdkClient,
        query: { locale },
        fetch: serverSdkFetchNoStore,
      }),
      specialistsList({
        client: sdkClient,
        query: { locale },
        fetch: serverSdkFetchNoStore,
      }),
    ]);
    if (!orgRes.error && orgRes.data) {
      initialOrganizations = orgRes.data.organizations;
    }
    if (!specRes.error && specRes.data) {
      initialSpecialists = specRes.data.specialists;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-surface-background" />
      }
    >
      <div className="flex min-h-screen flex-col">
        <SearchPageClient
          initialOrganizations={initialOrganizations}
          initialSpecialists={initialSpecialists}
        />
      </div>
    </Suspense>
  );
}
