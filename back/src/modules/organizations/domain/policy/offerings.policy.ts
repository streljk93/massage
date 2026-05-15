import { Rules } from './organization-policy.rules';
import {
  OrganizationCapabilities,
  allow,
  deny,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

export const offeringsPolicy: Partial<
  Record<OrganizationCapability, PolicyHandler>
> = {
  [OrganizationCapabilities.OFFERINGS_VIEW]: (ctx) =>
    !Rules.isMember(ctx) ? deny('NOT_MEMBER') : allow(),
  [OrganizationCapabilities.OFFERINGS_MANAGE]: (ctx) =>
    !Rules.isMember(ctx)
      ? deny('NOT_MEMBER')
      : Rules.isManager(ctx)
        ? allow()
        : deny('NOT_MANAGER'),
};

