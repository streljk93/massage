"use client";

import { Building2, ChevronRight, Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  organizationsCabinetGetCabinetOrganizationProfileForEdit,
  organizationsCabinetGetCabinetOrganizationTeamMembers,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import { cn, motion } from "@/shared/lib";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { useQuery } from "@tanstack/react-query";
import { OrganizationOfferingDraftCreateSection } from "./organization-offering-draft-create-section";

const CABINET_EDIT_QK = ["organizationCabinetEditProfile"] as const;
const CABINET_TEAM_QK = ["organizationCabinetTeam"] as const;

function roleAllowsSalonCabinetEditing(role: string): boolean {
  return role === "owner" || role === "admin";
}

function orgRoleLabelKey(
  role: string,
): "orgRoleOwner" | "orgRoleAdmin" | "orgRoleSpecialist" {
  if (role === "owner") {
    return "orgRoleOwner";
  }
  if (role === "admin") {
    return "orgRoleAdmin";
  }
  return "orgRoleSpecialist";
}

export function BusinessOrganizationCabinetPage() {
  const t = useTranslations("businessOrganizationCabinetPage");
  const tOfferings = useTranslations("businessOrganizationOfferingsPage");
  const tPage = useTranslations("businessAppSubpages");
  const locale = useLocale() as AppLocale;
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId ?? "";

  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const authed = sessionStatus === "authenticated" && accessToken.length > 0;

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
    () => membershipsQuery.data?.organizations.find((o) => o.id === organizationId),
    [membershipsQuery.data?.organizations, organizationId],
  );

  const employed =
    membership != null &&
    membership.membershipStatus === "employed" &&
    organizationId !== "";

  const canManage =
    employed &&
    roleAllowsSalonCabinetEditing(membership.role as "owner" | "admin" | "specialist");

  const teamQuery = useQuery({
    queryKey: [...CABINET_TEAM_QK, organizationId, accessToken, locale] as const,
    enabled: authed && employed && membershipsQuery.isSuccess,
    queryFn: async () => {
      const { data: res, error: err } = await organizationsCabinetGetCabinetOrganizationTeamMembers({
        client: sdk,
        path: { organizationId },
      });
      if (err || !res) {
        throw err ?? new Error("cabinet-team");
      }
      return res;
    },
  });

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

  const backToOrgs = {
    href: "/business/organizations",
    ariaLabel: t("backAria"),
  } as const;

  const membershipDraftName = membership?.salonCabinetPreview?.name?.trim();
  const orgTitle =
    membershipDraftName != null && membershipDraftName.length > 0 ?
      membershipDraftName
    : (membership?.name ?? "");

  if (
    sessionStatus === "loading" ||
    membershipsQuery.isPending ||
    (employed && teamQuery.isPending)
  ) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
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
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
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
    organizationId === "" ||
    !employed
  ) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
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

  if (teamQuery.isError) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={orgTitle !== "" ? orgTitle : t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
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
          onClick={() => void teamQuery.refetch()}
        >
          {tPage("orgsRetry")}
        </button>
      </main>
    );
  }

  if (canManage && cabinetProfileQuery.isError) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
        <BusinessScreenHeader
          title={orgTitle !== "" ? orgTitle : t("pageTitle")}
          titleVariant="section"
          showHeadline={false}
          avatarAlt={t("pageTitle")}
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

  const members = teamQuery.data?.members ?? [];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-8">
      <BusinessScreenHeader
        title={orgTitle !== "" ? orgTitle : t("pageTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("pageTitle")}
        avatarFallback="B"
        cabinetBack={backToOrgs}
      />

      <Link
        href={`/organizations/${organizationId}`}
        className={cn(
          motion.interactive,
          "text-sm font-medium text-primary underline-offset-2 hover:underline",
        )}
      >
        {tPage("orgOpenPublicProfile")}
      </Link>

      <section
        className="rounded-2xl border border-border/60 bg-card p-4 text-card-foreground"
        aria-labelledby="org-cabinet-staff-heading"
      >
        <h2 id="org-cabinet-staff-heading" className="font-heading text-sm font-semibold">
          {t("staffSectionTitle")}
        </h2>
        <ul className="mt-3 flex flex-col gap-2" aria-label={t("staffListAria")}>
          {members.map((m) => (
            <li
              key={m.specialistId}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="min-w-0 font-medium">
                {m.displayName ?? m.specialistId}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {tPage(orgRoleLabelKey(m.role))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {canManage ?
        <>
          {cabinetProfileQuery.isSuccess ?
            <OrganizationOfferingDraftCreateSection
              organizationId={organizationId}
              sdk={sdk}
              locale={locale}
              majorCategorySlugs={cabinetProfileQuery.data.majorCategorySlugs}
              t={tOfferings}
            />
          : cabinetProfileQuery.isPending ?
            <div className="h-36 animate-pulse rounded-2xl bg-muted/50" aria-busy />
          : null}

          <Link
            href={`/business/organizations/${organizationId}/offerings`}
            className={cn(
              motion.interactive,
              "flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left text-card-foreground shadow-none transition-colors hover:bg-muted/40",
            )}
            aria-label={t("manageOfferingsAria")}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-heading text-sm font-semibold leading-snug">
                {t("manageOfferingsTitle")}
              </span>
              <span className="text-pretty text-xs leading-snug text-muted-foreground">
                {t("manageOfferingsHint")}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>

          <Link
            href={`/business/organizations/${organizationId}/edit`}
            className={cn(
              motion.interactive,
              "flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left text-card-foreground shadow-none transition-colors hover:bg-muted/40",
            )}
            aria-label={t("editProfileAria")}
          >
            <Pencil className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-heading text-sm font-semibold leading-snug">
                {t("editProfileTitle")}
              </span>
              <span className="text-pretty text-xs leading-snug text-muted-foreground">
                {t("editProfileHint")}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </>
      : (
        <p className="text-pretty text-sm leading-snug text-muted-foreground">
          {t("specialistCabinetHint")}
        </p>
      )}
    </main>
  );
}
