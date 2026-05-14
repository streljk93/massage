import { Rules } from './organization-policy.rules';
import {
  OrganizationCapabilities,
  allow,
  deny,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

/**
 * Плейсхолдеры навигации кабинета без отдельного доменного API:
 * доступны только менеджерам организации (как найм).
 */
export const cabinetSectionsPolicy: Partial<
  Record<OrganizationCapability, PolicyHandler>
> = {
  [OrganizationCapabilities.MARKETING_VIEW]: (ctx) =>
    !Rules.isMember(ctx)
      ? deny('NOT_MEMBER')
      : Rules.isManager(ctx)
        ? allow()
        : deny('NOT_MANAGER'),

  [OrganizationCapabilities.ANALYTICS_VIEW]: (ctx) =>
    !Rules.isMember(ctx)
      ? deny('NOT_MEMBER')
      : Rules.isManager(ctx)
        ? allow()
        : deny('NOT_MANAGER'),
};
