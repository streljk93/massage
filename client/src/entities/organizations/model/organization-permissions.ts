export const OrganizationCapabilities = {
  PROFILE_MANAGE: "organization.profile.manage",
  DELETE: "organization.delete",
  TEAM_VIEW: "organization.team.view",
  TEAM_MANAGE_ROLES: "organization.team.manage_roles",
  TEAM_REMOVE_MEMBERS: "organization.team.remove_members",
  JOIN_REQUESTS_REVIEW: "organization.join_requests.review",
  OFFERINGS_VIEW: "organization.offerings.view",
  OFFERINGS_MANAGE: "organization.offerings.manage",
  HIRING_VIEW: "organization.hiring.view",
  HIRING_MANAGE: "organization.hiring.manage",
  HIRING_REVIEW_APPLICATIONS: "organization.hiring.review_applications",
  HIRING_ACCEPT: "organization.hiring.accept",
  MARKETING_VIEW: "organization.marketing.view",
  ANALYTICS_VIEW: "organization.analytics.view",
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
  MANAGE_WORKING_HOURS: "manage_working_hours",
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
  offerings: { view: boolean; manage: boolean };
  hiring: {
    view: boolean;
    manage: boolean;
    reviewApplications: boolean;
    accept: boolean;
  };
  marketing: { view: boolean };
  analytics: { view: boolean };
  calendar: {
    view: boolean;
    viewAll: boolean;
    manage: boolean;
    manageAll: boolean;
    manageWorkingHours: boolean;
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
    case OrganizationCapabilities.TEAM_REMOVE_MEMBERS:
      return permissions.team.removeMembers;
    case OrganizationCapabilities.JOIN_REQUESTS_REVIEW:
      return permissions.joinRequests.review;
    case OrganizationCapabilities.OFFERINGS_VIEW:
      return permissions.offerings.view;
    case OrganizationCapabilities.OFFERINGS_MANAGE:
      return permissions.offerings.manage;
    case OrganizationCapabilities.HIRING_VIEW:
      return permissions.hiring.view;
    case OrganizationCapabilities.HIRING_MANAGE:
      return permissions.hiring.manage;
    case OrganizationCapabilities.HIRING_REVIEW_APPLICATIONS:
      return permissions.hiring.reviewApplications;
    case OrganizationCapabilities.HIRING_ACCEPT:
      return permissions.hiring.accept;
    case OrganizationCapabilities.MARKETING_VIEW:
      return permissions.marketing.view;
    case OrganizationCapabilities.ANALYTICS_VIEW:
      return permissions.analytics.view;
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
    case OrganizationCalendarActions.MANAGE_WORKING_HOURS:
      return permissions.calendar.manageWorkingHours;
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
