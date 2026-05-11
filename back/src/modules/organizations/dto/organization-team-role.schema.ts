import { z } from 'zod';

export const organizationTeamRoleBodySchema = z
  .object({
    role: z.enum(['admin', 'specialist']),
  })
  .strict();

export type OrganizationTeamRoleBody = z.infer<
  typeof organizationTeamRoleBodySchema
>;

