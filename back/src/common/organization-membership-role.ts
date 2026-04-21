import { OrganizationMembershipRole } from '@prisma/client';

/** Уровень для сравнения «не ниже чем» (owner > admin > specialist). */
const ORGANIZATION_MEMBERSHIP_ROLE_ORDER: Record<
  OrganizationMembershipRole,
  number
> = {
  [OrganizationMembershipRole.specialist]: 0,
  [OrganizationMembershipRole.admin]: 1,
  [OrganizationMembershipRole.owner]: 2,
};

export function organizationMembershipRoleAtLeast(
  actual: OrganizationMembershipRole,
  required: OrganizationMembershipRole,
): boolean {
  return (
    ORGANIZATION_MEMBERSHIP_ROLE_ORDER[actual] >=
    ORGANIZATION_MEMBERSHIP_ROLE_ORDER[required]
  );
}
