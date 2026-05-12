"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  Loader2,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import type { AppLocale } from "@/app/i18n/routing";
import { BusinessEmptyState } from "@/entities/business";
import {
  canOrganization,
  OrganizationCalendarActions,
  OrganizationCapabilities,
  pickActiveWorkplaceOrganization,
  specialistMyOrganizationsQueryKey,
} from "@/entities/organizations";
import { useSetBusinessPageTitle } from "@/widgets/business/chrome";
import {
  calendarGetResourceAvailability,
  calendarListResources,
  calendarPutResourceAvailabilityRulesBulk,
  calendarPutResourceAvailabilityRules,
  createBrowserSdkClient,
  organizationsCabinetDeleteCabinetOrganizationTeamMember,
  organizationsCabinetGetCabinetOrganizationTeamInviteCandidates,
  organizationsCabinetGetCabinetOrganizationTeamMembers,
  organizationsCabinetPatchCabinetOrganizationTeamMemberRole,
  organizationsCabinetPostCabinetOrganizationTeamInvitation,
  specialistsCabinetGetSpecialistMyOrganizations,
} from "@/shared/api";
import type {
  CalendarGetResourceAvailabilityResponse,
  CalendarListResourcesResponse,
  OrganizationsCabinetGetCabinetOrganizationTeamInviteCandidatesResponses,
  OrganizationsCabinetGetCabinetOrganizationTeamMembersResponse,
} from "@/shared/api/generated/sdk/types.gen";
import { cn, motion } from "@/shared/lib";
import { confirmAction, notify } from "@/shared/lib/notifications";
import {
  Avatar,
  AvatarFallback,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/shared/ui";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

type SdkClient = ReturnType<typeof createBrowserSdkClient>;

const TEAM_QK = ["businessSpecialistsTeam"] as const;
const DIRECT_INVITE_QK = ["businessSpecialistsDirectInvite"] as const;
const RESOURCES_QK = ["businessSpecialistsResources"] as const;
const AVAILABILITY_QK = ["businessSpecialistsAvailability"] as const;

type TeamMember =
  OrganizationsCabinetGetCabinetOrganizationTeamMembersResponse["members"][number];
type InviteCandidate =
  OrganizationsCabinetGetCabinetOrganizationTeamInviteCandidatesResponses[200]["specialists"][number];
type CalendarResource = CalendarListResourcesResponse["resources"][number];
type AvailabilityRuleItem =
  CalendarGetResourceAvailabilityResponse["rules"][number];

// --- schedule helpers ---

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

type DaySchedule = { enabled: boolean; startMinute: number; endMinute: number };
type WeekSchedule = Record<number, DaySchedule>;

/** Цель редактирования: специалист + конкретный день или все дни. */
type EditTarget =
  | { resourceId: string; weekday: null }
  | { resourceId: string; weekday: number }
  | null;

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Короткое отображение для ячейки сетки: «9» вместо «09:00», «9:30» вместо «09:30». */
function shortTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? String(h) : `${h}:${m.toString().padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [rawH = "0", rawM = "0"] = time.split(":");
  const h = parseInt(rawH, 10);
  const m = parseInt(rawM, 10);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function emptyWeekSchedule(): WeekSchedule {
  const s: WeekSchedule = {};
  for (const d of WEEKDAYS) {
    s[d] = { enabled: false, startMinute: 9 * 60, endMinute: 18 * 60 };
  }
  return s;
}

function rulesToSchedule(rules: AvailabilityRuleItem[]): WeekSchedule {
  const s = emptyWeekSchedule();
  for (const rule of rules) {
    if (rule.type === "working" && rule.weekday >= 0 && rule.weekday <= 6) {
      s[rule.weekday] = {
        enabled: true,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
      };
    }
  }
  return s;
}

function scheduleToRulesBody(s: WeekSchedule) {
  return Object.entries(s)
    .filter(([, day]) => day.enabled)
    .map(([weekday, day]) => ({
      weekday: parseInt(weekday, 10),
      startMinute: day.startMinute,
      endMinute: day.endMinute,
      type: "working" as const,
    }));
}

function weekdayI18nKey(weekday: number) {
  const map = {
    0: "weekdaySun",
    1: "weekdayMon",
    2: "weekdayTue",
    3: "weekdayWed",
    4: "weekdayThu",
    5: "weekdayFri",
    6: "weekdaySat",
  } as const;
  return map[weekday as keyof typeof map] ?? ("weekdayMon" as const);
}

function roleAvatarClassName(role: string): string {
  if (role === "owner") return "bg-primary/15 text-primary font-semibold";
  if (role === "admin")
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold";
  return "bg-muted text-muted-foreground font-medium";
}

const TEAM_ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  admin: "roleAdmin",
  specialist: "roleSpecialist",
} as const;

function roleLabelKey(
  role: string,
): (typeof TEAM_ROLE_LABEL_KEYS)[keyof typeof TEAM_ROLE_LABEL_KEYS] {
  return (
    TEAM_ROLE_LABEL_KEYS[role as keyof typeof TEAM_ROLE_LABEL_KEYS] ??
    "roleSpecialist"
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return (
    (parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")
  ).toUpperCase();
}

// --- page ---

export function BusinessSpecialistsPage() {
  const t = useTranslations("businessSpecialistsPage");
  useSetBusinessPageTitle(t("title"));
  const locale = useLocale() as AppLocale;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? "";
  const authed = sessionStatus === "authenticated" && accessToken.length > 0;
  const queryClient = useQueryClient();

  const [inviteSearchInput, setInviteSearchInput] = useState("");
  const [debouncedInviteSearch, setDebouncedInviteSearch] = useState("");
  const [invitedSpecialistIds, setInvitedSpecialistIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedInviteSearch(inviteSearchInput.trim()),
      350,
    );
    return () => window.clearTimeout(id);
  }, [inviteSearchInput]);

  const sdk = useMemo(
    () => createBrowserSdkClient(accessToken, { locale }),
    [accessToken, locale],
  );

  const orgsQuery = useQuery({
    queryKey: specialistMyOrganizationsQueryKey(accessToken, locale),
    enabled: authed,
    queryFn: async () => {
      const { data, error } =
        await specialistsCabinetGetSpecialistMyOrganizations({ client: sdk });
      if (error || !data) throw error ?? new Error("organizations");
      return data;
    },
  });

  const activeOrg = useMemo(
    () => pickActiveWorkplaceOrganization(orgsQuery.data),
    [orgsQuery.data],
  );
  const organizationId = activeOrg?.id ?? "";
  const canInvite = canOrganization(
    activeOrg,
    OrganizationCapabilities.JOIN_REQUESTS_REVIEW,
  );
  const canManageWorkingHours = canOrganization(
    activeOrg,
    OrganizationCapabilities.CALENDAR,
    { calendarAction: OrganizationCalendarActions.MANAGE_WORKING_HOURS },
  );

  const teamQuery = useQuery({
    queryKey: [...TEAM_QK, organizationId, accessToken, locale],
    enabled: authed && organizationId.length > 0,
    queryFn: async () => {
      const { data, error } =
        await organizationsCabinetGetCabinetOrganizationTeamMembers({
          client: sdk,
          path: { organizationId },
        });
      if (error || !data) throw error ?? new Error("team");
      return data;
    },
  });

  const resourcesQuery = useQuery({
    queryKey: [...RESOURCES_QK, accessToken, locale],
    enabled: authed,
    queryFn: async () => {
      const { data, error } = await calendarListResources({ client: sdk });
      if (error || !data) throw error ?? new Error("resources");
      return data;
    },
  });

  const directInviteQuery = useQuery({
    queryKey: [...DIRECT_INVITE_QK, accessToken, locale, debouncedInviteSearch],
    enabled:
      authed &&
      canInvite &&
      organizationId.length > 0 &&
      debouncedInviteSearch.length >= 2,
    queryFn: async () => {
      const { data, error } =
        await organizationsCabinetGetCabinetOrganizationTeamInviteCandidates({
          client: sdk,
          path: { organizationId },
          query: { q: debouncedInviteSearch, limit: 10 },
        });
      if (error || !data) throw error ?? new Error("candidates");
      return data;
    },
  });

  const specialistResources = useMemo(
    () =>
      (resourcesQuery.data?.resources ?? []).filter(
        (r) => r.type === "specialist",
      ),
    [resourcesQuery.data?.resources],
  );

  const roleMutation = useMutation({
    mutationFn: async ({
      employmentId,
      role,
    }: {
      employmentId: string;
      role: "admin" | "specialist";
    }) => {
      const { error } =
        await organizationsCabinetPatchCabinetOrganizationTeamMemberRole({
          client: sdk,
          path: { organizationId, employmentId },
          body: { role },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAM_QK });
      void queryClient.invalidateQueries({ queryKey: RESOURCES_QK });
      void queryClient.invalidateQueries({ queryKey: AVAILABILITY_QK });
    },
    onError: () => notify.error(t("errorRoleChange")),
  });

  const removeMutation = useMutation({
    mutationFn: async (employmentId: string) => {
      const { error } =
        await organizationsCabinetDeleteCabinetOrganizationTeamMember({
          client: sdk,
          path: { organizationId, employmentId },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAM_QK });
      void queryClient.invalidateQueries({ queryKey: RESOURCES_QK });
      void queryClient.invalidateQueries({ queryKey: AVAILABILITY_QK });
    },
    onError: () => notify.error(t("errorRemoveMember")),
  });

  const inviteMutation = useMutation({
    mutationFn: async (specialistId: string) => {
      const { error } =
        await organizationsCabinetPostCabinetOrganizationTeamInvitation({
          client: sdk,
          path: { organizationId },
          body: { specialistId, targetRole: "specialist" },
        });
      if (error) throw error;
      return specialistId;
    },
    onSuccess: (specialistId) => {
      setInvitedSpecialistIds((prev) => new Set(prev).add(specialistId));
      void queryClient.invalidateQueries({ queryKey: DIRECT_INVITE_QK });
      notify.success(t("inviteSentTitle"));
    },
    onError: () => notify.error(t("errorInvite")),
  });

  if (sessionStatus === "loading" || orgsQuery.isPending) {
    return (
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-2">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </main>
    );
  }

  if (!authed || activeOrg == null) {
    return (
      <main className="flex w-full flex-1 flex-col px-4 pt-2">
        <BusinessEmptyState
          icon={Users}
          title={t("emptyNoOrganizationTitle")}
          description={t("emptyNoOrganizationHint")}
        />
      </main>
    );
  }

  const team = teamQuery.data?.members ?? [];
  const viewerCanManageTeamRoles =
    teamQuery.data?.permissions.team.manageRoles ?? false;
  const viewerCanRemoveTeamMembers =
    teamQuery.data?.permissions.team.removeMembers ?? false;
  /** Плашка под иконку удаления — чтобы селекты ролей стояли ровно у админа/владельца. */
  const viewerSeesTeamRemoveColumn =
    viewerCanManageTeamRoles || viewerCanRemoveTeamMembers;
  const teamSpecialistIds = new Set(team.map((m) => m.specialistId));
  const inviteCandidates = (directInviteQuery.data?.specialists ?? []).filter(
    (s) => !s.alreadyMember && !teamSpecialistIds.has(s.specialistId),
  );

  const anyTeamBusy = roleMutation.isPending || removeMutation.isPending;

  return (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-0 pb-6">
      {canInvite ? (
        <div className="px-4 pt-2 pb-3">
          <InvitePanel
            canInvite={canInvite}
            searchInput={inviteSearchInput}
            onSearchInputChange={setInviteSearchInput}
            candidates={inviteCandidates}
            loading={
              directInviteQuery.isPending && debouncedInviteSearch.length >= 2
            }
            invitedSpecialistIds={invitedSpecialistIds}
            disabled={inviteMutation.isPending}
            onInvite={(specialistId) => inviteMutation.mutate(specialistId)}
            pendingSpecialistId={inviteMutation.variables ?? null}
          />
        </div>
      ) : null}

      <div className="px-4">
        {teamQuery.isPending ? (
          <div className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 min-w-0 flex-1 rounded" />
                <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
                <Skeleton className="size-8 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>
        ) : team.length === 0 ? (
          <p className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            {t("teamEmpty")}
          </p>
        ) : (
          <ul
            className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card"
            role="list"
          >
            {team.map((member) => (
              <TeamRow
                key={member.employmentId}
                member={member}
                onRole={(employmentId, role) =>
                  roleMutation.mutate({ employmentId, role })
                }
                onRemove={async (employmentId) => {
                  const ok = await confirmAction({
                    title: t("removeConfirmTitle"),
                    description: t("removeConfirmDescription", {
                      name:
                        member.displayName ?? t("removeConfirmNameFallback"),
                    }),
                    confirmLabel: t("removeConfirmAction"),
                    cancelLabel: t("removeConfirmBack"),
                    destructive: true,
                  });
                  if (ok) removeMutation.mutate(employmentId);
                }}
                roleBusy={
                  roleMutation.isPending &&
                  roleMutation.variables?.employmentId === member.employmentId
                }
                removeBusy={
                  removeMutation.isPending &&
                  removeMutation.variables === member.employmentId
                }
                anyBusy={anyTeamBusy}
                viewerCanManageTeamRoles={viewerCanManageTeamRoles}
                reserveRemoveColumnSlot={viewerSeesTeamRemoveColumn}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 px-4">
        <WorkingHoursSection
          specialistResources={specialistResources}
          team={team}
          sdk={sdk}
          accessToken={accessToken}
          canManage={canManageWorkingHours}
        />
      </div>
    </main>
  );
}

// --- TeamRow ---

function TeamRow({
  member,
  onRole,
  onRemove,
  roleBusy,
  removeBusy,
  anyBusy,
  viewerCanManageTeamRoles,
  reserveRemoveColumnSlot,
}: {
  member: TeamMember;
  onRole: (employmentId: string, role: "admin" | "specialist") => void;
  onRemove: (employmentId: string) => Promise<void>;
  roleBusy: boolean;
  removeBusy: boolean;
  anyBusy: boolean;
  viewerCanManageTeamRoles: boolean;
  reserveRemoveColumnSlot: boolean;
}) {
  const t = useTranslations("businessSpecialistsPage");
  const canRemove = member.permissions.remove;
  const initials = getInitials(member.displayName);
  const profileHref = `/specialists/${member.specialistId}`;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link
        href={profileHref}
        className={cn(
          motion.interactive,
          "flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
        )}
        aria-label={t("openMemberProfileAria", {
          name: member.displayName ?? member.specialistId,
        })}
      >
        <Avatar className="shrink-0">
          <AvatarFallback className={roleAvatarClassName(member.role)}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-semibold leading-tight">
          {member.displayName ?? member.specialistId}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {roleBusy ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
        {viewerCanManageTeamRoles ? (
          <Select
            value={member.role}
            disabled={anyBusy || !member.permissions.manageRole}
            onValueChange={(value) => {
              if (value === "admin" || value === "specialist") {
                onRole(member.employmentId, value);
              }
            }}
          >
            <SelectTrigger
              size="sm"
              className={cn(
                "!min-h-8 h-8 w-[7.25rem] gap-1 rounded-md px-2 py-0 text-[0.6875rem] leading-none [&_svg]:!size-3",
                "border-border bg-white hover:border-border hover:bg-white",
                "dark:border-input dark:bg-background dark:hover:bg-background",
              )}
              aria-label={t("roleSelectAria")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] p-0.5">
              {member.role === "owner" ? (
                <SelectItem
                  value="owner"
                  className="min-h-0 rounded-md py-1.5 pr-2 pl-2 text-[0.6875rem] leading-tight [&>span:first-of-type]:hidden"
                >
                  {t("roleOwner")}
                </SelectItem>
              ) : (
                <>
                  <SelectItem
                    value="admin"
                    className="min-h-0 rounded-md py-1.5 pr-2 pl-2 text-[0.6875rem] leading-tight [&>span:first-of-type]:hidden"
                  >
                    {t("roleAdmin")}
                  </SelectItem>
                  <SelectItem
                    value="specialist"
                    className="min-h-0 rounded-md py-1.5 pr-2 pl-2 text-[0.6875rem] leading-tight [&>span:first-of-type]:hidden"
                  >
                    {t("roleSpecialist")}
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t(roleLabelKey(member.role))}
          </span>
        )}

        {canRemove ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={anyBusy}
            onClick={() => void onRemove(member.employmentId)}
            aria-label={t("removeMemberAria")}
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {removeBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
          </Button>
        ) : reserveRemoveColumnSlot ? (
          <span className="inline-flex size-8 shrink-0" aria-hidden />
        ) : null}
      </div>
    </li>
  );
}

// --- InvitePanel ---

function InvitePanel({
  canInvite,
  searchInput,
  onSearchInputChange,
  candidates,
  loading,
  invitedSpecialistIds,
  disabled,
  onInvite,
  pendingSpecialistId,
}: {
  canInvite: boolean;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  candidates: InviteCandidate[];
  loading: boolean;
  invitedSpecialistIds: Set<string>;
  disabled: boolean;
  onInvite: (specialistId: string) => void;
  pendingSpecialistId: string | null;
}) {
  const t = useTranslations("businessSpecialistsPage");
  const showEmpty =
    canInvite &&
    searchInput.trim().length >= 2 &&
    !loading &&
    candidates.length === 0;

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder={t("directInviteSearchPlaceholder")}
          className={cn(
            "min-h-10 rounded-xl",
            "border border-border bg-white hover:bg-white focus-visible:bg-white",
            "dark:bg-background dark:hover:bg-background dark:focus-visible:bg-background",
            "pl-9",
          )}
          disabled={!canInvite}
          aria-label={t("inviteSearchAria")}
        />
      </div>

      {canInvite && (loading || candidates.length > 0 || showEmpty) ? (
        <div className="mt-2 flex flex-col divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
          {loading ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            </div>
          ) : null}

          {candidates.map((s) => {
            const invited = invitedSpecialistIds.has(s.specialistId);
            const isSubmitting =
              disabled && pendingSpecialistId === s.specialistId;
            return (
              <div
                key={s.specialistId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Link
                  href={`/specialists/${s.specialistId}`}
                  className={cn(
                    motion.interactive,
                    "flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
                  )}
                  aria-label={t("openMemberProfileAria", {
                    name: s.displayName ?? s.specialistId,
                  })}
                >
                  <Avatar className="shrink-0">
                    <AvatarFallback className="bg-muted font-medium text-muted-foreground">
                      {getInitials(s.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {s.displayName ?? s.specialistId}
                    </p>
                    {s.headline ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {s.headline}
                      </p>
                    ) : null}
                  </div>
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled || invited}
                  onClick={() => onInvite(s.specialistId)}
                  className="shrink-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="size-4" aria-hidden />
                  )}
                  {invited ? t("directInviteSent") : t("directInviteSend")}
                </Button>
              </div>
            );
          })}

          {showEmpty ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {t("directInviteNoResults")}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// --- WorkingHoursSection ---

function WorkingHoursSection({
  specialistResources,
  team,
  sdk,
  accessToken,
  canManage,
}: {
  specialistResources: CalendarResource[];
  team: TeamMember[];
  sdk: SdkClient;
  accessToken: string;
  canManage: boolean;
}) {
  const t = useTranslations("businessSpecialistsPage");

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" aria-hidden />
        <h2 className="font-heading text-base font-semibold">
          {canManage ? t("workingHoursTitle") : t("yourWorkingHoursTitle")}
        </h2>
      </div>

      {specialistResources.length === 0 ? (
        <p className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          {t("noResource")}
        </p>
      ) : canManage ? (
        <WorkingHoursGrid
          specialistResources={specialistResources}
          team={team}
          sdk={sdk}
          accessToken={accessToken}
        />
      ) : (
        <WorkingHoursReadOnly
          resourceId={specialistResources[0]!.id}
          sdk={sdk}
          accessToken={accessToken}
        />
      )}
    </section>
  );
}

// --- WorkingHoursGrid ---

/**
 * Колонка специалиста: от 9.5rem до 11rem.
 * Каждый день: минимум 2.75rem (44px), максимум 1fr — тянется на широком экране.
 * Итого минимум: ~9.5rem + 7×2.75rem = ~28.75rem (460px) — на мобильном
 * срабатывает overflow-x-auto и сетка горизонтально скроллится.
 */
const WEEK_GRID_TEMPLATE =
  "minmax(6rem, 8rem) repeat(7, minmax(2.75rem, 1fr))";

function WorkingHoursGrid({
  specialistResources,
  team,
  sdk,
  accessToken,
}: {
  specialistResources: CalendarResource[];
  team: TeamMember[];
  sdk: SdkClient;
  accessToken: string;
}) {
  const t = useTranslations("businessSpecialistsPage");
  const queryClient = useQueryClient();

  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editSchedule, setEditSchedule] = useState<WeekSchedule>(
    emptyWeekSchedule,
  );
  const [isDirty, setIsDirty] = useState(false);

  // Загружаем расписание для каждого ресурса параллельно
  const availabilityQueries = useQueries({
    queries: specialistResources.map((r) => ({
      queryKey: [...AVAILABILITY_QK, r.id, accessToken],
      queryFn: async () => {
        const { data, error } = await calendarGetResourceAvailability({
          client: sdk,
          path: { resourceId: r.id },
        });
        if (error || !data) throw error ?? new Error("availability");
        return data;
      },
    })),
  });

  const schedulesMap = useMemo(() => {
    const map = new Map<string, WeekSchedule>();
    specialistResources.forEach((r, i) => {
      const q = availabilityQueries[i];
      if (q?.data) {
        map.set(r.id, rulesToSchedule(q.data.rules));
      }
    });
    return map;
  }, [availabilityQueries, specialistResources]);

  const allLoading = availabilityQueries.some((q) => q.isPending);

  const saveRulesMutation = useMutation({
    mutationFn: async ({
      resourceIds,
      rules,
    }: {
      resourceIds: string[];
      rules: ReturnType<typeof scheduleToRulesBody>;
    }) => {
      if (resourceIds.length > 1) {
        const { error } = await calendarPutResourceAvailabilityRulesBulk({
          client: sdk,
          body: { resourceIds, rules },
        });
        if (error) throw error;
        return;
      }
      const resourceId = resourceIds[0];
      if (!resourceId) throw new Error("no resourceId");
      const { error } = await calendarPutResourceAvailabilityRules({
        client: sdk,
        path: { resourceId },
        body: { rules },
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      for (const id of vars.resourceIds) {
        void queryClient.invalidateQueries({
          queryKey: [...AVAILABILITY_QK, id, accessToken],
        });
      }
      notify.success(
        vars.resourceIds.length > 1
          ? t("workingHoursSavedAll", { count: vars.resourceIds.length })
          : t("workingHoursSaved"),
      );
      setEditTarget(null);
      setIsDirty(false);
    },
    onError: () => notify.error(t("workingHoursSaveError")),
  });

  const openEdit = (resourceId: string, weekday: number | null) => {
    const saved = schedulesMap.get(resourceId) ?? emptyWeekSchedule();
    setEditSchedule({ ...saved });
    setIsDirty(false);
    setEditTarget(
      weekday !== null ? { resourceId, weekday } : { resourceId, weekday: null },
    );
  };

  const updateEditDay = (weekday: number, updates: Partial<DaySchedule>) => {
    setEditSchedule((prev) => ({
      ...prev,
      [weekday]: { ...prev[weekday]!, ...updates },
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!editTarget) return;
    saveRulesMutation.mutate({
      resourceIds: [editTarget.resourceId],
      rules: scheduleToRulesBody(editSchedule),
    });
  };

  const getResourceDisplayName = (resource: CalendarResource) => {
    if (resource.specialistId) {
      const member = team.find((m) => m.specialistId === resource.specialistId);
      if (member?.displayName) return member.displayName;
    }
    return resource.name;
  };

  const saving = saveRulesMutation.isPending;

  // ── Панель редактирования ──
  if (editTarget !== null) {
    const resource = specialistResources.find(
      (r) => r.id === editTarget.resourceId,
    );
    const displayName = resource
      ? getResourceDisplayName(resource)
      : editTarget.resourceId;
    const panelTitle =
      editTarget.weekday !== null
        ? `${displayName} · ${t(weekdayI18nKey(editTarget.weekday))}`
        : displayName;
    const weekdaysToShow: number[] =
      editTarget.weekday !== null ? [editTarget.weekday] : [...WEEKDAYS];

    return (
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        {/* Шапка панели */}
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setEditTarget(null);
              setIsDirty(false);
            }}
            className={cn(
              motion.interactive,
              "flex items-center gap-1 rounded-lg text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span>{t("backToGrid")}</span>
          </button>
          <span className="text-muted-foreground/40" aria-hidden>
            /
          </span>
          <span className="min-w-0 truncate text-sm font-medium">
            {panelTitle}
          </span>
        </div>

        {/* Строки дней */}
        <div className="divide-y divide-border/40">
          {weekdaysToShow.map((weekday) => {
            const day = editSchedule[weekday] ?? {
              enabled: false,
              startMinute: 9 * 60,
              endMinute: 18 * 60,
            };
            return (
              <ScheduleRow
                key={weekday}
                label={t(weekdayI18nKey(weekday))}
                schedule={day}
                onUpdate={(updates) => updateEditDay(weekday, updates)}
                disabled={saving}
                editable
              />
            );
          })}
        </div>

        {/* Подвал */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            type="button"
            disabled={!isDirty || saving}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {t("saveSchedule")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Обзорная сетка ──
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {/* overflow-x-auto здесь: внутренний блок шире мобильного экрана → скролл */}
      <div className="overflow-x-auto">
        {/* min-w соответствует WEEK_GRID_TEMPLATE: ~6rem + 7×2.75rem ≈ 25.5rem */}
        <div className="min-w-[26rem]">
          {/* Заголовок: дни недели */}
          <div
            className="grid w-full border-b border-border/40"
            style={{ gridTemplateColumns: WEEK_GRID_TEMPLATE }}
          >
            {/* sticky-ячейка заголовка — пустая, но держит фон */}
            <div className="sticky left-0 z-10 bg-card px-4 py-2.5 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/40" />
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="min-w-0 px-1 py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t(weekdayI18nKey(wd))}
              </div>
            ))}
          </div>

          {/* Строки специалистов */}
          {allLoading
            ? Array.from({
                length: specialistResources.length || 2,
              }).map((_, i) => (
                <div
                  key={i}
                  className="grid w-full border-b border-border/40 last:border-b-0"
                  style={{ gridTemplateColumns: WEEK_GRID_TEMPLATE }}
                >
                  {/* sticky skeleton для колонки специалиста */}
                  <div className="sticky left-0 z-10 flex items-center bg-card px-4 py-3 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/40">
                    <Skeleton className="h-4 flex-1 rounded" />
                  </div>
                  {WEEKDAYS.map((wd) => (
                    <div
                      key={wd}
                      className="flex flex-col items-center justify-center gap-1 py-3"
                    >
                      <Skeleton className="size-2 rounded-full" />
                      <Skeleton className="h-2.5 w-7 rounded" />
                    </div>
                  ))}
                </div>
              ))
            : specialistResources.map((resource) => {
                const schedule = schedulesMap.get(resource.id);
                const displayName = getResourceDisplayName(resource);

                return (
                  <div
                    key={resource.id}
                    className="grid w-full border-b border-border/40 last:border-b-0"
                    style={{ gridTemplateColumns: WEEK_GRID_TEMPLATE }}
                  >
                    {/* Имя специалиста → редактировать все дни (sticky) */}
                    <button
                      type="button"
                      onClick={() => openEdit(resource.id, null)}
                      className={cn(
                        motion.interactive,
                        "sticky left-0 z-10 flex items-center bg-card px-4 py-3 text-left",
                        "after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/40",
                      )}
                      aria-label={t("editAllDaysAria", { name: displayName })}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {displayName}
                      </span>
                    </button>

                    {/* Ячейки дней → редактировать конкретный день */}
                    {WEEKDAYS.map((wd) => {
                      const day = schedule?.[wd];
                      const isWorking = day?.enabled === true;

                      return (
                        <button
                          key={wd}
                          type="button"
                          onClick={() => openEdit(resource.id, wd)}
                          className={cn(
                            motion.interactive,
                            "flex min-w-0 w-full flex-col items-center justify-center gap-0.5 px-0.5 py-3",
                          )}
                          aria-label={t("editDayAria", {
                            name: displayName,
                            day: t(weekdayI18nKey(wd)),
                          })}
                        >
                          <span
                            className={cn(
                              "size-2 rounded-full transition-colors",
                              isWorking ? "bg-primary" : "bg-border",
                            )}
                          />
                          {isWorking && day ? (
                            <span className="max-w-full truncate text-center text-[0.6rem] tabular-nums leading-tight text-muted-foreground">
                              {shortTime(day.startMinute)}–
                              {shortTime(day.endMinute)}
                            </span>
                          ) : (
                            <span className="text-[0.6rem] leading-tight text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}

// --- WorkingHoursReadOnly ---

function WorkingHoursReadOnly({
  resourceId,
  sdk,
  accessToken,
}: {
  resourceId: string;
  sdk: SdkClient;
  accessToken: string;
}) {
  const t = useTranslations("businessSpecialistsPage");

  const query = useQuery({
    queryKey: [...AVAILABILITY_QK, resourceId, accessToken],
    enabled: resourceId.length > 0,
    queryFn: async () => {
      const { data, error } = await calendarGetResourceAvailability({
        client: sdk,
        path: { resourceId },
      });
      if (error || !data) throw error ?? new Error("availability");
      return data;
    },
  });

  const schedule = useMemo(
    () =>
      query.data ? rulesToSchedule(query.data.rules) : emptyWeekSchedule(),
    [query.data],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {query.isPending ? (
        <div className="divide-y divide-border/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2.5"
            >
              <Skeleton className="h-4 w-10 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {WEEKDAYS.map((weekday) => {
            const day = schedule[weekday] ?? {
              enabled: false,
              startMinute: 9 * 60,
              endMinute: 18 * 60,
            };
            const timeText = day.enabled
              ? `${minutesToTime(day.startMinute)} — ${minutesToTime(day.endMinute)}`
              : t("dayOff");
            return (
              <div
                key={weekday}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2.5"
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    !day.enabled && "text-muted-foreground",
                  )}
                >
                  {t(weekdayI18nKey(weekday))}
                </span>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    !day.enabled && "text-xs text-muted-foreground",
                  )}
                >
                  {timeText}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- ScheduleRow ---

function ScheduleRow({
  label,
  schedule,
  onUpdate,
  disabled,
  editable,
}: {
  label: string;
  schedule: DaySchedule;
  onUpdate: (updates: Partial<DaySchedule>) => void;
  disabled: boolean;
  editable: boolean;
}) {
  const t = useTranslations("businessSpecialistsPage");
  const timeText = schedule.enabled
    ? `${minutesToTime(schedule.startMinute)} — ${minutesToTime(schedule.endMinute)}`
    : t("dayOff");

  if (!editable) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2.5">
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            !schedule.enabled && "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <div className="flex h-8 items-center justify-end">
          <span
            className={cn(
              "text-sm tabular-nums",
              !schedule.enabled && "text-xs text-muted-foreground",
            )}
          >
            {timeText}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-4 py-2.5">
      <Switch
        size="default"
        checked={schedule.enabled}
        onCheckedChange={(enabled) => onUpdate({ enabled })}
        disabled={disabled}
        aria-label={label}
      />
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          !schedule.enabled && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {schedule.enabled ? (
        <div className="flex h-8 items-center gap-1.5">
          <input
            type="time"
            value={minutesToTime(schedule.startMinute)}
            onChange={(e) =>
              onUpdate({ startMinute: timeToMinutes(e.target.value) })
            }
            disabled={disabled}
            className="h-8 w-[5.5rem] rounded-lg border border-border bg-white px-2 text-sm tabular-nums disabled:opacity-50 dark:bg-background"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="time"
            value={minutesToTime(schedule.endMinute)}
            onChange={(e) =>
              onUpdate({ endMinute: timeToMinutes(e.target.value) })
            }
            disabled={disabled}
            className="h-8 w-[5.5rem] rounded-lg border border-border bg-white px-2 text-sm tabular-nums disabled:opacity-50 dark:bg-background"
          />
        </div>
      ) : (
        <div className="flex h-8 items-center justify-end">
          <span className="text-xs text-muted-foreground">{t("dayOff")}</span>
        </div>
      )}
    </div>
  );
}
