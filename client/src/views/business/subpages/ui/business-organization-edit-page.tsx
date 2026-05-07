"use client";

import { Building2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  OrganizationSalonCabinetForm,
  SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX,
  specialistMyOrganizationsQueryKey,
  type OrganizationSalonCabinetFormInitialValues,
  type OrganizationSalonCabinetSubmitBody,
} from "@/entities/organizations";
import type { OrganizationsCabinetGetCabinetOrganizationProfileForEditResponse } from "@/shared/api";
import {
  createBrowserSdkClient,
  filesUploadPublic,
  organizationsCabinetGetCabinetOrganizationProfileForEdit,
  organizationsCabinetPatchOrganization,
  organizationsCabinetPostActivityMajorsChangePreview,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import { cn, motion } from "@/shared/lib";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { parseVnLocalForInput } from "@/views/business/setup/lib/specialist-onboarding-utils";

import { confirmAction } from "@/shared/lib/notifications";

const CABINET_EDIT_QK = ["organizationCabinetEditProfile"] as const;

type AffectedSalonServiceRow = {
  id: string;
  categoryName?: string | null;
};

function OrganizationEditRemoveMajorsServicesConfirmBody({
  rows,
}: {
  rows: AffectedSalonServiceRow[];
}) {
  const tPage = useTranslations("businessAppSubpages");
  return (
    <div className="min-w-0 w-full space-y-2 pt-1 text-foreground">
      <p className="min-w-0 max-w-full text-pretty text-sm leading-snug text-muted-foreground">
        {tPage("organizationEditDisableServicesConfirmLead")}
      </p>
      <ul
        className="max-h-44 w-full min-w-0 max-w-full list-none divide-y divide-border overflow-y-auto overflow-x-hidden rounded-lg border border-border/70 bg-card p-0 shadow-sm overscroll-contain"
        role="list"
        aria-label={tPage("organizationEditDisableServicesListAria")}
      >
        {rows.map((s) => (
          <li
            key={s.id}
            className="min-w-0 px-2 py-1.5 text-left text-[0.8125rem] leading-tight font-medium"
          >
            {s.categoryName ?? s.id}
          </li>
        ))}
      </ul>
    </div>
  );
}

function roleAllowsSalonCabinetEditing(role: string): boolean {
  return role === "owner" || role === "admin";
}

function cabinetProfileToFormInitialValues(
  profile: OrganizationsCabinetGetCabinetOrganizationProfileForEditResponse,
): OrganizationSalonCabinetFormInitialValues {
  const placePicked =
    profile.placeReference != null ?
      JSON.stringify({
        p: profile.placeReference.provider,
        i: profile.placeReference.placeId,
        ...(profile.latitude != null &&
        profile.longitude != null &&
        !Number.isNaN(profile.latitude) &&
        !Number.isNaN(profile.longitude) ?
          {
            lat: profile.latitude,
            lng: profile.longitude,
            city: profile.city ?? null,
          }
        : {}),
      })
    : null;

  const legacyCoordinates =
    placePicked == null &&
    profile.latitude != null &&
    profile.longitude != null &&
    !Number.isNaN(profile.latitude) &&
    !Number.isNaN(profile.longitude) ?
      {
        addressLine: profile.addressLine?.trim() ?? "",
        latitude: profile.latitude,
        longitude: profile.longitude,
        city: profile.city ?? null,
      }
    : null;

  const years =
    profile.yearsInBusiness == null ? ""
    : String(Math.min(80, Math.max(0, profile.yearsInBusiness)));

  return {
    name: profile.name,
    description: profile.description ?? "",
    addrQ: profile.addressLine?.trim() ?? "",
    placePicked,
    legacyCoordinates,
    phoneLocal: parseVnLocalForInput(profile.phone),
    email: profile.email ?? "",
    website: profile.website ?? "",
    years,
    majorCategorySlugs: [...profile.majorCategorySlugs],
    gallery: profile.galleryItems.map((g) => ({
      url: g.url,
      alt: g.alt,
    })),
  };
}

export function BusinessOrganizationEditPage() {
  const t = useTranslations("specialistOnboarding");
  const tPage = useTranslations("businessAppSubpages");
  const locale = useLocale() as AppLocale;
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

  const backToOrgs = {
    href: "/business/organizations",
    ariaLabel: tPage("organizationEditBackAria"),
  } as const;

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const membershipsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
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

  const membership = useMemo(
    () =>
      membershipsQuery.data?.organizations.find((o) => o.id === organizationId) ??
      undefined,
    [membershipsQuery.data?.organizations, organizationId],
  );

  const canManage =
    membership != null &&
    membership.membershipStatus === "employed" &&
    roleAllowsSalonCabinetEditing(membership.role as "owner" | "admin" | "specialist");

  const cabinetProfileQuery = useQuery({
    queryKey: [...CABINET_EDIT_QK, organizationId, accessToken, locale] as const,
    enabled:
      authed &&
      typeof organizationId === "string" &&
      organizationId.length > 0 &&
      canManage &&
      membershipsQuery.isSuccess,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: res, error: err } = await organizationsCabinetGetCabinetOrganizationProfileForEdit(
        {
          client: sdk,
          path: { organizationId },
          query: { locale },
        },
      );
      if (err || !res) {
        throw err ?? new Error("cabinet-profile");
      }
      return res;
    },
  });

  const submitPatch = async (body: OrganizationSalonCabinetSubmitBody) => {
    if (!organizationId) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const previewPayload = {
        client: sdk,
        path: { organizationId },
        query: { locale },
        body: {
          majorCategorySlugs: body.majorCategorySlugs ?? [],
        },
        suppressGlobalErrorToast: true,
      };
      const previewRes = (await organizationsCabinetPostActivityMajorsChangePreview(
        previewPayload as Parameters<
          typeof organizationsCabinetPostActivityMajorsChangePreview
        >[0],
      )) as {
        error?: unknown;
        data?: { affectedServices: AffectedSalonServiceRow[] };
      };
      if (previewRes.error || !previewRes.data) {
        setFormError(tPage("orgSwitchWorkplacePreviewLoadError"));
        return;
      }

      let bodyToSend: OrganizationSalonCabinetSubmitBody = body;

      const affectedFromPreview = previewRes.data.affectedServices;
      if (affectedFromPreview.length > 0) {
        const confirmed = await confirmAction({
          title: tPage("organizationEditDisableServicesConfirmTitle"),
          body: (
            <OrganizationEditRemoveMajorsServicesConfirmBody
              rows={affectedFromPreview}
            />
          ),
          confirmLabel: tPage("organizationEditDisableServicesConfirmAction"),
          cancelLabel: tPage("organizationEditDisableServicesConfirmBack"),
          destructive: true,
        });
        if (!confirmed) {
          return;
        }
        bodyToSend = {
          ...body,
          confirmDisableServiceIds: affectedFromPreview.map((s) => s.id),
        };
      }

      const { error } = await organizationsCabinetPatchOrganization({
        client: sdk,
        path: { organizationId },
        query: { locale },
        body: bodyToSend,
      });
      if (error) {
        const confirmPayload = error as {
          code?: string;
          affectedServices?: AffectedSalonServiceRow[];
        };
        if (
          confirmPayload.code === "MAJOR_CATEGORY_DISABLE_CONFIRM_REQUIRED" &&
          Array.isArray(confirmPayload.affectedServices) &&
          confirmPayload.affectedServices.length > 0
        ) {
          const confirmed = await confirmAction({
            title: tPage("organizationEditDisableServicesConfirmTitle"),
            body: (
              <OrganizationEditRemoveMajorsServicesConfirmBody
                rows={confirmPayload.affectedServices}
              />
            ),
            confirmLabel: tPage("organizationEditDisableServicesConfirmAction"),
            cancelLabel: tPage("organizationEditDisableServicesConfirmBack"),
            destructive: true,
          });
          if (confirmed) {
            const retry = await organizationsCabinetPatchOrganization({
              client: sdk,
              path: { organizationId },
              query: { locale },
              body: {
                ...body,
                confirmDisableServiceIds: confirmPayload.affectedServices.map(
                  (s) => s.id,
                ),
              } as OrganizationSalonCabinetSubmitBody,
            });
            if (!retry.error) {
              await Promise.all([
                queryClient.invalidateQueries({
                  predicate: (q) =>
                    Array.isArray(q.queryKey) &&
                    q.queryKey[0] ===
                      SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX[0],
                }),
                queryClient.invalidateQueries({
                  predicate: (q) =>
                    Array.isArray(q.queryKey) &&
                    q.queryKey[0] === CABINET_EDIT_QK[0] &&
                    q.queryKey[1] === organizationId,
                }),
              ]);
              router.replace("/business/organizations");
              return;
            }
          }
        }
        setFormError(t("vErrCreateOrg"));
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX[0],
        }),
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === CABINET_EDIT_QK[0] &&
            q.queryKey[1] === organizationId,
        }),
      ]);
      router.replace("/business/organizations");
    } finally {
      setSubmitting(false);
    }
  };

  const initialValues =
    cabinetProfileQuery.data ?
      cabinetProfileToFormInitialValues(cabinetProfileQuery.data)
    : null;

  if (
    sessionStatus === "loading" ||
    membershipsQuery.isPending ||
    (canManage && cabinetProfileQuery.isPending)
  ) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationEditTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationEditTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy />
      </main>
    );
  }

  if (sessionStatus === "unauthenticated" || !accessToken) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationEditTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationEditTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={tPage("orgsSignInTitle")}
          description={tPage("orgsSignInHint")}
        />
      </main>
    );
  }

  if (
    membershipsQuery.isError ||
    !membership ||
    organizationId == null ||
    organizationId === ""
  ) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationEditTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationEditTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={tPage("organizationEditNotFoundTitle")}
          description={tPage("organizationEditNotFoundHint")}
        />
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationEditTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationEditTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={membership.name}
          description={tPage("organizationEditForbiddenHint")}
        />
      </main>
    );
  }

  if (cabinetProfileQuery.isError) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={tPage("organizationEditTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={tPage("organizationEditTitle")}
          avatarFallback="B"
          cabinetBack={backToOrgs}
        />
        <BusinessEmptyState
          icon={Building2}
          title={tPage("organizationEditLoadErrorTitle")}
          description={tPage("organizationEditLoadErrorHint")}
        />
        <button
          type="button"
          className={cn(
            motion.interactive,
            "text-sm font-medium text-primary underline-offset-2 hover:underline",
          )}
          onClick={() => void cabinetProfileQuery.refetch()}
        >
          {tPage("orgsRetry")}
        </button>
      </main>
    );
  }

  const membershipDraft = membership.salonCabinetPreview;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={
          membershipDraft != null && membershipDraft.name.trim().length > 0 ?
            membershipDraft.name
          : membership.name
        }
        titleVariant="section"
        showHeadline={false}
        avatarAlt={tPage("organizationEditTitle")}
        avatarFallback="B"
        cabinetBack={backToOrgs}
      />

      <OrganizationSalonCabinetForm
        t={t}
        client={sdk}
        locale={locale}
        catalogQueryAccessToken={accessToken}
        initialSyncKey={`${organizationId}:${cabinetProfileQuery.dataUpdatedAt}`}
        initialValues={initialValues}
        formError={formError}
        onClearFormError={() => setFormError(null)}
        reportError={setFormError}
        submitting={submitting}
        submitLabel={tPage("organizationEditSave")}
        uploadPublicFile={async (file) => {
          const up = await filesUploadPublic({ client: sdk, body: { file } });
          if (up.error || !up.data?.url) {
            throw new Error("upload");
          }
          return up.data.url;
        }}
        onSubmit={submitPatch}
      />
    </main>
  );
}
