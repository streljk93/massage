import type {
  OrganizationAccessContext,
  OrganizationAccessLevel,
} from './organization-policy.types';

export const OrganizationAccessMatrix = {
  SUPER_ADMIN: { member: false, manageAll: false, manageOwn: false },
  OWNER: { member: true, manageAll: true, manageOwn: true },
  ADMIN: { member: true, manageAll: true, manageOwn: true },
  SPECIALIST: { member: true, manageAll: false, manageOwn: true },
  NONE: { member: false, manageAll: false, manageOwn: false },
} as const satisfies Record<
  OrganizationAccessLevel,
  { member: boolean; manageAll: boolean; manageOwn: boolean }
>;

export function resolveOrganizationAccessLevel(
  ctx: OrganizationAccessContext,
): OrganizationAccessLevel {
  if (ctx.isPlatformMaster) return 'SUPER_ADMIN';
  if (ctx.isOwner) return 'OWNER';
  if (ctx.role === 'admin') return 'ADMIN';
  if (ctx.role === 'specialist') return 'SPECIALIST';
  return 'NONE';
}

export function accessFlags(ctx: OrganizationAccessContext) {
  return OrganizationAccessMatrix[resolveOrganizationAccessLevel(ctx)];
}

export function canAccessAllBookings(ctx: OrganizationAccessContext): boolean {
  return accessFlags(ctx).manageAll;
}

export function canAccessOwnBookings(ctx: OrganizationAccessContext): boolean {
  return accessFlags(ctx).manageOwn && ctx.specialistId != null;
}

export function canAccessAllResources(ctx: OrganizationAccessContext): boolean {
  return accessFlags(ctx).manageAll;
}

export function canAccessOwnResources(ctx: OrganizationAccessContext): boolean {
  return accessFlags(ctx).manageOwn && ctx.specialistId != null;
}

export function canManageOrganizationProfile(
  ctx: OrganizationAccessContext,
): boolean {
  return accessFlags(ctx).manageAll;
}

export function canViewOrganizationTeam(
  ctx: OrganizationAccessContext,
): boolean {
  return accessFlags(ctx).member;
}

export function canManageOrganizationTeamRoles(
  ctx: OrganizationAccessContext,
): boolean {
  return ctx.isOwner;
}

