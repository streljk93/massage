import {
  canAccessAllBookings,
  canManageOrganizationProfile,
  canViewOrganizationTeam,
} from './organization-access-matrix';
import {
  OrganizationCalendarActions,
  allow,
  deny,
  parseOrganizationSubject,
  type OrganizationAccessContext,
  type OrganizationPolicyDecision,
  type OrganizationPolicySubject,
} from './organization-policy.types';

export function isOwnBooking(
  ctx: OrganizationAccessContext,
  subject: Extract<NonNullable<OrganizationPolicySubject>, { type: 'Booking' }>,
): boolean {
  return ctx.specialistId != null && subject.specialistId === ctx.specialistId;
}

export function isOwnResource(
  ctx: OrganizationAccessContext,
  subject: Extract<
    NonNullable<OrganizationPolicySubject>,
    { type: 'Resource' }
  >,
): boolean {
  return ctx.specialistId != null && subject.specialistId === ctx.specialistId;
}

export const Rules = {
  isManager: (ctx: OrganizationAccessContext): boolean =>
    canManageOrganizationProfile(ctx),

  isMember: (ctx: OrganizationAccessContext): boolean =>
    canViewOrganizationTeam(ctx),

  canManageBooking: (
    ctx: OrganizationAccessContext,
    subject?: OrganizationPolicySubject,
  ): OrganizationPolicyDecision => {
    if (!Rules.isMember(ctx)) {
      return deny('NOT_MEMBER');
    }
    const booking = parseOrganizationSubject(subject, 'Booking');
    if (!booking.ok) {
      return deny(booking.reason);
    }
    if (canAccessAllBookings(ctx) || isOwnBooking(ctx, booking.subject)) {
      return allow();
    }
    return deny('NOT_OWN_BOOKING');
  },

  canCancelBooking: (
    ctx: OrganizationAccessContext,
    subject?: OrganizationPolicySubject,
  ): OrganizationPolicyDecision => {
    if (!Rules.isMember(ctx)) {
      return deny('NOT_MEMBER');
    }
    const booking = parseOrganizationSubject(subject, 'Booking');
    if (!booking.ok) {
      return deny(booking.reason);
    }
    if (canAccessAllBookings(ctx)) {
      return allow();
    }
    return deny('NOT_MANAGER');
  },

  canViewBooking: (
    ctx: OrganizationAccessContext,
    subject?: OrganizationPolicySubject,
  ): OrganizationPolicyDecision => {
    if (!Rules.isMember(ctx)) {
      return deny('NOT_MEMBER');
    }
    const booking = parseOrganizationSubject(subject, 'Booking');
    if (!booking.ok) {
      return deny(booking.reason);
    }
    if (canAccessAllBookings(ctx) || isOwnBooking(ctx, booking.subject)) {
      return allow();
    }
    return deny('NOT_OWN_BOOKING');
  },

  canManageResource: (
    ctx: OrganizationAccessContext,
    subject?: OrganizationPolicySubject,
  ): OrganizationPolicyDecision => {
    if (!Rules.isMember(ctx)) {
      return deny('NOT_MEMBER');
    }
    const resource = parseOrganizationSubject(subject, 'Resource');
    if (!resource.ok) {
      return deny(resource.reason);
    }
    if (resource.subject.action === OrganizationCalendarActions.VIEW) {
      return allow();
    }
    if (
      resource.subject.action ===
      OrganizationCalendarActions.MANAGE_WORKING_HOURS
    ) {
      return Rules.isManager(ctx) ? allow() : deny('NOT_MANAGER');
    }
    if (Rules.isManager(ctx)) {
      return allow();
    }
    if (!isOwnResource(ctx, resource.subject)) {
      return deny('NOT_OWN_RESOURCE');
    }
    if (resource.subject.createdByUserId === ctx.userId) {
      return allow();
    }
    return deny('NOT_RESOURCE_EVENT_AUTHOR');
  },
};
