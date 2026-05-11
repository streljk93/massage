import { throwPolicyForbidden } from '../../../../common/authz';
import { bookingPolicy } from './booking.policy';
import { calendarPolicy } from './calendar.policy';
import { offeringsPolicy } from './offerings.policy';
import { profilePolicy } from './profile.policy';
import { teamPolicy } from './team.policy';
import {
  OrganizationBookingActions,
  OrganizationCapabilities,
  deny,
  parseOrganizationSubject,
  type OrganizationAccessContext,
  type OrganizationAbility,
  type OrganizationCapability,
  type OrganizationPolicyDecision,
  type OrganizationPolicyDecisionMetadata,
  type OrganizationPolicySubject,
  type PolicyHandler,
} from './organization-policy.types';

export * from './organization-access-matrix';
export * from './organization-policy.rules';
export * from './organization-policy.types';

export const organizationPolicyMap: Record<
  OrganizationCapability,
  PolicyHandler
> = {
  ...profilePolicy,
  ...teamPolicy,
  ...offeringsPolicy,
  ...calendarPolicy,
  ...bookingPolicy,
} as Record<OrganizationCapability, PolicyHandler>;

type PlatformOrganizationPolicyHandler = (
  subject?: OrganizationPolicySubject,
) => boolean;

const platformOrganizationPolicy: Partial<
  Record<OrganizationCapability, boolean | PlatformOrganizationPolicyHandler>
> = {
  [OrganizationCapabilities.PROFILE_MANAGE]: true,
  [OrganizationCapabilities.TEAM_VIEW]: true,
  [OrganizationCapabilities.TEAM_MANAGE_ROLES]: false,
  [OrganizationCapabilities.JOIN_REQUESTS_REVIEW]: true,
  [OrganizationCapabilities.OFFERINGS_MANAGE]: false,
  [OrganizationCapabilities.CALENDAR]: false,
  [OrganizationCapabilities.DELETE]: false,
  [OrganizationCapabilities.BOOKINGS]: (subject) => {
    const booking = parseOrganizationSubject(subject, 'Booking');
    if (!booking.ok) return false;
    return booking.subject.action === OrganizationBookingActions.VIEW;
  },
};

function platformOrganizationOverridePolicy(
  ctx: OrganizationAccessContext,
  capability: OrganizationCapability,
  subject?: OrganizationPolicySubject,
): OrganizationPolicyDecision | null {
  if (!ctx.isPlatformMaster) return null;
  const rule = platformOrganizationPolicy[capability];
  const allowed = typeof rule === 'function' ? rule(subject) : rule === true;
  return allowed
    ? { allowed: true, reason: 'PLATFORM_OVERRIDE' }
    : deny('PLATFORM_CAPABILITY_DENIED');
}

function buildDecisionMetadata(
  ctx: OrganizationAccessContext,
  capability: OrganizationCapability,
  subject?: OrganizationPolicySubject,
): OrganizationPolicyDecisionMetadata {
  return {
    capability,
    subjectType: subject?.type,
    subjectAction:
      subject != null && 'action' in subject ? String(subject.action) : undefined,
    subjectSpecialistId:
      subject != null && 'specialistId' in subject
        ? subject.specialistId ?? null
        : undefined,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
  };
}

export function explainOrganizationPolicy(
  ctx: OrganizationAccessContext,
  capability: OrganizationCapability,
  subject?: OrganizationPolicySubject,
): OrganizationPolicyDecision {
  const metadata = buildDecisionMetadata(ctx, capability, subject);
  const platformOverride = platformOrganizationOverridePolicy(
    ctx,
    capability,
    subject,
  );
  if (platformOverride != null) {
    return { ...platformOverride, metadata };
  }

  const handler = organizationPolicyMap[capability];
  if (handler == null) {
    return { allowed: false, reason: 'CAPABILITY_UNKNOWN', metadata };
  }
  return { ...handler(ctx, subject), metadata };
}

export function buildOrganizationAbility(
  ctx: OrganizationAccessContext,
): OrganizationAbility {
  return {
    can: (capability, subject) =>
      explainOrganizationPolicy(ctx, capability, subject).allowed,
  };
}

export function canOrganization(
  ctx: OrganizationAccessContext,
  capability: OrganizationCapability,
  subject?: OrganizationPolicySubject,
): boolean {
  return buildOrganizationAbility(ctx).can(capability, subject);
}

export function assertCanOrganization(
  ctx: OrganizationAccessContext,
  capability: OrganizationCapability,
  subject?: OrganizationPolicySubject,
): void {
  const decision = explainOrganizationPolicy(ctx, capability, subject);
  if (!decision.allowed) {
    throwPolicyForbidden(capability, decision.reason);
  }
}

