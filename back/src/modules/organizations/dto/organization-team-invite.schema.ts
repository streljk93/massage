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

/** Создание учётки мастера салоном (без самостоятельной регистрации). */
export const organizationTeamProvisionMemberBodySchema = z
  .object({
    email: z.string().trim().min(3).max(255).email(),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(8).max(32).optional().nullable(),
    /** Если не задан — вход по паролю недоступен, пока пароль не выставят отдельно. */
    password: z.preprocess(
      (val) =>
        typeof val === 'string' && val.trim() === '' ? undefined : val,
      z.string().min(8).max(256).optional().nullable(),
    ),
    targetRole: z.enum(['admin', 'specialist']).default('specialist'),
    /** Публичный URL из POST /files/upload-public (витрина и запись). */
    imageUrl: z.string().min(1).max(2048).optional().nullable(),
  })
  .strict();

export type OrganizationTeamProvisionMemberBody = z.infer<
  typeof organizationTeamProvisionMemberBodySchema
>;
