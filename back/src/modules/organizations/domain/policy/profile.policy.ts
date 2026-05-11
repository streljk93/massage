import { Rules } from './organization-policy.rules';
import {
  OrganizationCapabilities,
  allow,
  deny,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

export const profilePolicy: Partial<Record<OrganizationCapability, PolicyHandler>> =
  {
    [OrganizationCapabilities.PROFILE_MANAGE]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : Rules.isManager(ctx)
          ? allow()
          : deny('NOT_MANAGER'),

    [OrganizationCapabilities.DELETE]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : ctx.isOwner
          ? allow()
          : deny('NOT_OWNER'),
  };

