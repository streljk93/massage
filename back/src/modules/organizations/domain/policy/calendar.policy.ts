import { Rules } from './organization-policy.rules';
import {
  OrganizationCapabilities,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

export const calendarPolicy: Partial<Record<OrganizationCapability, PolicyHandler>> =
  {
    [OrganizationCapabilities.CALENDAR]: (ctx, subject) =>
      Rules.canManageResource(ctx, subject),
  };

