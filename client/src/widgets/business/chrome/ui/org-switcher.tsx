"use client";

import { Building2, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import {
  SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX,
  cabinetOrganizationCoverSrc,
  displayNameForCabinetOrganization,
  pickSelectedContextOrganization,
  useSpecialistMyOrganizationsQuery,
  type SpecialistMyOrganizationRow,
} from "@/entities/organizations";
import {
  createBrowserSdkClient,
  specialistsCabinetPatchSpecialistActiveOrganization,
} from "@/shared/api";
import { cn, motion } from "@/shared/lib";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui";

const BUSINESS_ORGANIZATION_CONTEXT_QUERY_PREFIXES = [
  SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX[0],
  "businessClients",
  "specialistSalonBookings",
  "businessSpecialistsTeam",
  "businessSpecialistsDirectInvite",
  "jobs",
  "contacts",
  "candidates",
  "businessHiringCabinetProfile",
  "businessSpecialistCandidates",
  "businessSpecialistSearchJobs",
  "businessSpecialistJobPosting",
  "businessSpecialistJobContacts",
  "businessHiringJobCabinetProfile",
  "organizationCabinetEditProfile",
  "organizationCabinetTeam",
  "organizationOfferingsCabinet",
  "organizationOfferingsAssignableSpecialists",
] as const;

const RESOURCE_SCOPED_QUERY_PREFIXES = [
  "businessCalendarResources",
  "businessCalendarEvents",
  "businessCalendarAvailability",
  "businessSpecialistsResources",
  "businessSpecialistsAvailability",
] as const;

function OrgAvatar({
  org,
  size = "md",
}: {
  org: SpecialistMyOrganizationRow | null;
  size?: "sm" | "md";
}) {
  const cover = org != null ? cabinetOrganizationCoverSrc(org) : null;
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-lg bg-muted/50",
        size === "sm" ? "size-7" : "size-9",
      )}
      aria-hidden
    >
      {cover != null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Building2
            className={cn("opacity-50", size === "sm" ? "size-3.5" : "size-4")}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}

export type OrgSwitcherProps = {
  className?: string;
};

/**
 * Переключатель организации в кабинете мастера.
 * Меняет UI-контекст (activeOrganizationId) — не влияет на бизнес-логику витрины.
 */
export function OrgSwitcher({ className }: OrgSwitcherProps) {
  const t = useTranslations("orgSwitcher");
  const locale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = status === "authenticated" && accessToken.length > 0;
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const orgsQuery = useSpecialistMyOrganizationsQuery({ enabled: authed });

  const selectedOrg = useMemo(
    () => pickSelectedContextOrganization(orgsQuery.data),
    [orgsQuery.data],
  );

  const employedOrgs = useMemo(
    () =>
      (orgsQuery.data?.organizations ?? []).filter(
        (o) => o.membershipStatus === "employed",
      ),
    [orgsQuery.data?.organizations],
  );

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const switchMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { data: res, error } = await specialistsCabinetPatchSpecialistActiveOrganization({
        client: sdk,
        body: { organizationId: orgId },
      });
      if (error || !res) throw error ?? new Error("switch_org");
      return res;
    },
    onSuccess: (_result, orgId) => {
      for (const prefix of RESOURCE_SCOPED_QUERY_PREFIXES) {
        void queryClient.cancelQueries({ queryKey: [prefix] });
        queryClient.removeQueries({ queryKey: [prefix] });
      }
      queryClient.setQueriesData(
        { queryKey: [...SPECIALIST_MY_ORGANIZATIONS_QUERY_KEY_PREFIX] },
        (old) => {
          if (old == null || typeof old !== "object") return old;
          return { ...old, activeOrganizationId: orgId };
        },
      );
      for (const prefix of BUSINESS_ORGANIZATION_CONTEXT_QUERY_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }
    },
  });

  const selectedName =
    selectedOrg != null ? displayNameForCabinetOrganization(selectedOrg) : null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            motion.interactivePressStrong,
            "group flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className,
          )}
          aria-label={t("triggerAria")}
        >
          <OrgAvatar org={selectedOrg} />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[0.6rem] leading-none font-medium text-muted-foreground">
              {t("label")}
            </p>
            <p className="mt-0.5 truncate text-[0.8125rem] font-semibold leading-tight tracking-tight text-foreground">
              {selectedName ?? t("noOrg")}
            </p>
            {selectedOrg?.isActiveWorkplace === true && (
              <p className="mt-0.5 text-[0.6rem] leading-none font-medium text-emerald-600 dark:text-emerald-400">
                {t("acceptingHere")}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "size-[0.9375rem] shrink-0 text-muted-foreground/70 transition-transform duration-150",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-[13rem] w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        {employedOrgs.map((org) => {
          const name = displayNameForCabinetOrganization(org);
          const isSelected = selectedOrg?.id === org.id;
          const isPending =
            switchMutation.isPending && switchMutation.variables === org.id;
          return (
            <DropdownMenuItem
              key={org.id}
              className="flex items-center gap-2.5 py-2 pl-2.5 pr-3 cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                if (!isSelected && !switchMutation.isPending) {
                  switchMutation.mutate(org.id);
                  setOpen(false);
                }
              }}
            >
              <OrgAvatar org={org} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {name}
              </span>
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : isSelected ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}

        {employedOrgs.length > 0 ? <DropdownMenuSeparator /> : null}

        <DropdownMenuItem asChild>
          <Link
            href="/business/organizations/new"
            className="flex items-center gap-2.5 py-2 pl-2.5 pr-3"
            onClick={() => setOpen(false)}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20">
              <Plus className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
            </div>
            <span className="text-sm text-muted-foreground">{t("createNew")}</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
