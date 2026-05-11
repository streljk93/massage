"use client";

import { Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  OrganizationSalonCabinetForm,
  specialistMyOrganizationsQueryKey,
  type OrganizationSalonCabinetSubmitBody,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  filesUploadPublic,
  organizationsCabinetPostCreateOrganization,
} from "@/shared/api";
import { useQueryClient } from "@tanstack/react-query";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
const ONB_QK = ["specialistOnboarding"] as const;

export function BusinessOrganizationCreatePage() {
  const t = useTranslations("specialistOnboarding");
  const tPage = useTranslations("businessAppSubpages");
  useSetBusinessPageTitle(tPage("organizationCreateTitle"));
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [createOrgSubmitting, setCreateOrgSubmitting] = useState(false);

  const submitCreate = async (body: OrganizationSalonCabinetSubmitBody) => {
    setCreateOrgSubmitting(true);
    setFormError(null);
    try {
      const { error } = await organizationsCabinetPostCreateOrganization({
        client: sdk,
        query: { locale },
        body,
      });
      if (error) {
        setFormError(t("vErrCreateOrg"));
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ONB_QK, accessToken, locale] }),
        queryClient.invalidateQueries({
          queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
        }),
      ]);
      router.replace("/business/organizations");
    } finally {
      setCreateOrgSubmitting(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
        <BusinessEmptyState
          icon={Building2}
          title={tPage("orgsSignInTitle")}
          description={tPage("orgsSignInHint")}
        />
      </main>
    );
  }

  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-5 px-4 pt-2">
      <OrganizationSalonCabinetForm
        t={t}
        client={sdk}
        locale={locale}
        catalogQueryAccessToken={accessToken}
        initialSyncKey="create"
        initialValues={null}
        formError={formError}
        onClearFormError={() => setFormError(null)}
        reportError={setFormError}
        submitting={createOrgSubmitting}
        submitLabel={t("createSalonSubmit")}
        sectionTitle={t("orgFormTitle")}
        sectionHint={t("orgFormHint")}
        uploadPublicFile={async (file) => {
          const up = await filesUploadPublic({ client: sdk, body: { file } });
          if (up.error || !up.data?.url) {
            throw new Error("upload");
          }
          return up.data.url;
        }}
        onSubmit={submitCreate}
      />
    </main>
  );
}
