import { z } from 'zod';

export const organizationTeamInviteCandidatesQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(80),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();

export type OrganizationTeamInviteCandidatesQuery = z.infer<
  typeof organizationTeamInviteCandidatesQuerySchema
>;

export const organizationTeamInviteBodySchema = z
  .object({
    specialistId: z.string().uuid(),
    targetRole: z.enum(['admin', 'specialist']).default('specialist'),
    message: z.string().trim().max(2000).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict();

export const organizationTeamInviteRespondBodySchema = z
  .object({
    decision: z.enum(['accept', 'reject']),
  })
  .strict();

export type OrganizationTeamInviteBody = z.infer<
  typeof organizationTeamInviteBodySchema
>;
export type OrganizationTeamInviteRespondBody = z.infer<
  typeof organizationTeamInviteRespondBodySchema
>;
