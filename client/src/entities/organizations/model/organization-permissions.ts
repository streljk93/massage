export const OrganizationCapabilities = {
  PROFILE_MANAGE: "organization.profile.manage",
  DELETE: "organization.delete",
  TEAM_VIEW: "organization.team.view",
  TEAM_MANAGE_ROLES: "organization.team.manage_roles",
  JOIN_REQUESTS_REVIEW: "organization.join_requests.review",
  OFFERINGS_MANAGE: "organization.offerings.manage",
  CALENDAR: "organization.calendar",
  BOOKINGS: "organization.bookings",
} as const;

export const OrganizationBookingActions = {
  VIEW: "view",
  MANAGE: "manage",
  CONFIRM: "confirm",
  CANCEL: "cancel",
  RESCHEDULE: "reschedule",
} as const;

export const OrganizationCalendarActions = {
  VIEW: "view",
  MANAGE: "manage",
} as const;

export type OrganizationCapability =
  (typeof OrganizationCapabilities)[keyof typeof OrganizationCapabilities];

export type OrganizationBookingAction =
  (typeof OrganizationBookingActions)[keyof typeof OrganizationBookingActions];

export type OrganizationCalendarAction =
  (typeof OrganizationCalendarActions)[keyof typeof OrganizationCalendarActions];

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

export type OrganizationPermissionSource = {
  permissions?: OrganizationScopedPermissions | null;
};

type CanOrganizationOptions = {
  bookingAction?: OrganizationBookingAction;
  calendarAction?: OrganizationCalendarAction;
};

export function canOrganization(
  org: OrganizationPermissionSource | null | undefined,
  capability: OrganizationCapability,
  options?: CanOrganizationOptions,
): boolean {
  const permissions = org?.permissions;
  if (permissions == null) {
    return false;
  }

  switch (capability) {
    case OrganizationCapabilities.PROFILE_MANAGE:
      return permissions.profile.manage;
    case OrganizationCapabilities.DELETE:
      return permissions.profile.delete;
    case OrganizationCapabilities.TEAM_VIEW:
      return permissions.team.view;
    case OrganizationCapabilities.TEAM_MANAGE_ROLES:
      return permissions.team.manageRoles;
    case OrganizationCapabilities.JOIN_REQUESTS_REVIEW:
      return permissions.joinRequests.review;
    case OrganizationCapabilities.OFFERINGS_MANAGE:
      return permissions.offerings.manage;
    case OrganizationCapabilities.CALENDAR:
      return canCalendarAction(permissions, options?.calendarAction);
    case OrganizationCapabilities.BOOKINGS:
      return canBookingAction(permissions, options?.bookingAction);
  }
}

function canCalendarAction(
  permissions: OrganizationScopedPermissions,
  action: OrganizationCalendarAction | undefined,
): boolean {
  switch (action) {
    case OrganizationCalendarActions.VIEW:
      return permissions.calendar.view;
    case OrganizationCalendarActions.MANAGE:
    case undefined:
      return permissions.calendar.manage;
  }
}

function canBookingAction(
  permissions: OrganizationScopedPermissions,
  action: OrganizationBookingAction | undefined,
): boolean {
  switch (action) {
    case OrganizationBookingActions.VIEW:
      return permissions.bookings.view;
    case OrganizationBookingActions.CONFIRM:
      return permissions.bookings.confirm;
    case OrganizationBookingActions.CANCEL:
      return permissions.bookings.cancel;
    case OrganizationBookingActions.RESCHEDULE:
      return permissions.bookings.reschedule;
    case OrganizationBookingActions.MANAGE:
    case undefined:
      return permissions.bookings.manage;
  }
}
