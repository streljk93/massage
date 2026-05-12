import {
  canManageOrganizationTeamRoles,
  canRemoveOrganizationTeamMembers,
  canViewOrganizationTeam,
} from './organization-access-matrix';
import { Rules } from './organization-policy.rules';
import {
  OrganizationCapabilities,
  allow,
  deny,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

export const teamPolicy: Partial<Record<OrganizationCapability, PolicyHandler>> =
  {
    [OrganizationCapabilities.TEAM_VIEW]: (ctx) =>
      canViewOrganizationTeam(ctx) ? allow() : deny('NOT_MEMBER'),

    [OrganizationCapabilities.TEAM_MANAGE_ROLES]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : canManageOrganizationTeamRoles(ctx)
          ? allow()
          : deny('NOT_OWNER'),

    [OrganizationCapabilities.TEAM_REMOVE_MEMBERS]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : canRemoveOrganizationTeamMembers(ctx)
          ? allow()
          : deny('NOT_OWNER'),

    [OrganizationCapabilities.JOIN_REQUESTS_REVIEW]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : Rules.isManager(ctx)
          ? allow()
          : deny('NOT_MANAGER'),
  };

