import type { Ability } from '../../../../common/authz';

export const OrganizationCapabilities = {
  PROFILE_MANAGE: 'organization.profile.manage',
  DELETE: 'organization.delete',
  TEAM_VIEW: 'organization.team.view',
  TEAM_MANAGE_ROLES: 'organization.team.manage_roles',
  TEAM_REMOVE_MEMBERS: 'organization.team.remove_members',
  JOIN_REQUESTS_REVIEW: 'organization.join_requests.review',
  OFFERINGS_MANAGE: 'organization.offerings.manage',
  HIRING_VIEW: 'organization.hiring.view',
  HIRING_MANAGE: 'organization.hiring.manage',
  HIRING_REVIEW_APPLICATIONS: 'organization.hiring.review_applications',
  HIRING_ACCEPT: 'organization.hiring.accept',
  /** Раздел кабинета «Маркетинг» (навигация; отдельных API пока нет). */
  MARKETING_VIEW: 'organization.marketing.view',
  /** Раздел кабинета «Аналитика» (навигация; отдельных API пока нет). */
  ANALYTICS_VIEW: 'organization.analytics.view',
  CALENDAR: 'organization.calendar',
  BOOKINGS: 'organization.bookings',
} as const;

export const OrganizationBookingActions = {
  VIEW: 'view',
  MANAGE: 'manage',
  CONFIRM: 'confirm',
  CANCEL: 'cancel',
  RESCHEDULE: 'reschedule',
} as const;

export const OrganizationCalendarActions = {
  VIEW: 'view',
  MANAGE: 'manage',
  MANAGE_WORKING_HOURS: 'manage_working_hours',
} as const;

export type OrganizationCapability =
  (typeof OrganizationCapabilities)[keyof typeof OrganizationCapabilities];

export type OrganizationBookingAction =
  (typeof OrganizationBookingActions)[keyof typeof OrganizationBookingActions];

export type OrganizationCalendarAction =
  (typeof OrganizationCalendarActions)[keyof typeof OrganizationCalendarActions];

export type OrganizationPolicySubject =
  | { type: 'Organization'; organizationId: string }
  | {
      type: 'Booking';
      action: OrganizationBookingAction;
      organizationId: string;
      specialistId: string;
    }
  | {
      type: 'Resource';
      action: OrganizationCalendarAction;
      organizationId: string;
      specialistId?: string | null;
      createdByUserId?: string | null;
    }
  | null
  | undefined;

export type OrganizationAccessContext = {
  userId: string;
  organizationId: string;
  isOwner: boolean;
  role: 'admin' | 'specialist' | null;
  specialistId: string | null;
  isPlatformMaster: boolean;
};

export type OrganizationAccessLevel =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'SPECIALIST'
  | 'NONE';

export type OrganizationPolicyDenialReason =
  | 'NOT_MEMBER'
  | 'NOT_MANAGER'
  | 'NOT_OWNER'
  | 'SUBJECT_REQUIRED'
  | 'INVALID_SUBJECT'
  | 'NOT_OWN_BOOKING'
  | 'NOT_OWN_RESOURCE'
  | 'NOT_RESOURCE_EVENT_AUTHOR'
  | 'PLATFORM_CAPABILITY_DENIED'
  | 'CAPABILITY_UNKNOWN';

export type OrganizationPolicyDecisionMetadata = {
  capability: OrganizationCapability;
  subjectType?: NonNullable<OrganizationPolicySubject>['type'];
  subjectAction?: string;
  subjectSpecialistId?: string | null;
  userId: string;
  organizationId: string;
};

export type OrganizationPolicyDecision =
  | {
      allowed: true;
      reason?: 'PLATFORM_OVERRIDE';
      metadata?: OrganizationPolicyDecisionMetadata;
    }
  | {
      allowed: false;
      reason: OrganizationPolicyDenialReason;
      metadata?: OrganizationPolicyDecisionMetadata;
    };

export type OrganizationAbility = Ability<
  OrganizationCapability,
  OrganizationPolicySubject
>;

export type SubjectParseResult<T> =
  | { ok: true; subject: T }
  | { ok: false; reason: 'SUBJECT_REQUIRED' | 'INVALID_SUBJECT' };

export type PolicyHandler = (
  ctx: OrganizationAccessContext,
  subject?: OrganizationPolicySubject,
) => OrganizationPolicyDecision;

export const allow = (): OrganizationPolicyDecision => ({ allowed: true });

export const deny = (
  reason: OrganizationPolicyDenialReason,
): OrganizationPolicyDecision => ({ allowed: false, reason });

export function parseOrganizationSubject<
  T extends NonNullable<OrganizationPolicySubject>['type'],
>(
  subject: OrganizationPolicySubject,
  type: T,
): SubjectParseResult<
  Extract<NonNullable<OrganizationPolicySubject>, { type: T }>
> {
  if (subject == null || subject.type !== type) {
    return {
      ok: false,
      reason: subject == null ? 'SUBJECT_REQUIRED' : 'INVALID_SUBJECT',
    };
  }
  return {
    ok: true,
    subject: subject as Extract<
      NonNullable<OrganizationPolicySubject>,
      { type: T }
    >,
  };
}
