import {
  canAccessAllBookings,
  canAccessOwnBookings,
  canAccessAllResources,
  canAccessOwnResources,
  canManageOrganizationProfile,
  canManageOrganizationTeamRoles,
  canViewOrganizationTeam,
  type OrganizationAccessContext,
} from './policy';

export type OrganizationScopedPermissions = {
  profile: { manage: boolean; delete: boolean };
  team: { view: boolean; manageRoles: boolean; removeMembers: boolean };
  joinRequests: { review: boolean };
  offerings: { manage: boolean };
  calendar: {
    view: boolean;
    viewAll: boolean;
    manage: boolean;
    manageAll: boolean;
  };
  bookings: {
    view: boolean;
    manage: boolean;
    manageAll: boolean;
    manageOwn: boolean;
    confirm: boolean;
    cancel: boolean;
    reschedule: boolean;
  };
};

export function buildOrganizationPermissions(
  ctx: OrganizationAccessContext,
): OrganizationScopedPermissions {
  const canManageProfile = canManageOrganizationProfile(ctx);
  const canManageRoles = canManageOrganizationTeamRoles(ctx);
  const canViewTeam = canViewOrganizationTeam(ctx);
  const manageAllBookings = canAccessAllBookings(ctx);
  const manageOwnBookings = canAccessOwnBookings(ctx);
  const viewAllResources = canAccessAllResources(ctx);
  const viewOwnResources = canAccessOwnResources(ctx);
  const canManageBookings = manageAllBookings || manageOwnBookings;
  const canUseCalendar = viewAllResources || viewOwnResources;

  return {
    profile: { manage: canManageProfile, delete: ctx.isOwner },
    team: {
      view: canViewTeam,
      manageRoles: canManageRoles,
      removeMembers: canManageRoles,
    },
    joinRequests: { review: canManageProfile },
    offerings: { manage: canManageProfile },
    calendar: {
      view: canUseCalendar,
      viewAll: viewAllResources,
      manage: canUseCalendar,
      manageAll: viewAllResources,
    },
    bookings: {
      view: canManageBookings,
      manage: canManageBookings,
      manageAll: manageAllBookings,
      manageOwn: manageOwnBookings,
      confirm: canManageBookings,
      cancel: canManageBookings,
      reschedule: canManageBookings,
    },
  };
}

export function emptyOrganizationPermissions(): OrganizationScopedPermissions {
  return {
    profile: { manage: false, delete: false },
    team: { view: false, manageRoles: false, removeMembers: false },
    joinRequests: { review: false },
    offerings: { manage: false },
    calendar: { view: false, viewAll: false, manage: false, manageAll: false },
    bookings: {
      view: false,
      manage: false,
      manageAll: false,
      manageOwn: false,
      confirm: false,
      cancel: false,
      reschedule: false,
    },
  };
}
