import { Rules } from './organization-policy.rules';
import {
  OrganizationCapabilities,
  allow,
  deny,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

export const hiringPolicy: Partial<Record<OrganizationCapability, PolicyHandler>> =
  {
    [OrganizationCapabilities.HIRING_VIEW]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : Rules.isManager(ctx)
          ? allow()
          : deny('NOT_MANAGER'),

    [OrganizationCapabilities.HIRING_MANAGE]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : Rules.isManager(ctx)
          ? allow()
          : deny('NOT_MANAGER'),

    [OrganizationCapabilities.HIRING_REVIEW_APPLICATIONS]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : Rules.isManager(ctx)
          ? allow()
          : deny('NOT_MANAGER'),

    [OrganizationCapabilities.HIRING_ACCEPT]: (ctx) =>
      !Rules.isMember(ctx)
        ? deny('NOT_MEMBER')
        : Rules.isManager(ctx)
          ? allow()
          : deny('NOT_MANAGER'),
  };
