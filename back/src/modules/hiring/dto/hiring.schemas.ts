import { z } from 'zod';

export const hiringRoleSchema = z.enum(['admin', 'specialist']);

export const createJobPostingBodySchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(4000).optional().nullable(),
    requirements: z.string().trim().max(4000).optional().nullable(),
    organizationOfferingId: z.string().uuid().optional().nullable(),
    serviceCategoryId: z.string().uuid().optional().nullable(),
    experienceMinYears: z.number().int().min(0).max(80).optional().nullable(),
    role: hiringRoleSchema.default('specialist'),
    status: z.enum(['draft', 'open', 'closed']).default('draft'),
  })
  .strict();

export const patchJobPostingBodySchema = createJobPostingBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field',
  });

export const patchResumeBodySchema = z
  .object({
    headline: z.string().trim().max(140).optional().nullable(),
    summary: z.string().trim().max(4000).optional().nullable(),
    experienceYears: z.number().int().min(0).max(80).optional().nullable(),
    visibility: z.enum(['public', 'private']).optional(),
  })
  .strict();

export const candidateListQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(300).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(80).optional(),
    skillCategoryIds: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) =>
        value == null || value.length === 0
          ? []
          : value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 20),
      ),
    experienceMinYears: z.coerce.number().int().min(0).max(80).optional(),
    experienceMaxYears: z.coerce.number().int().min(0).max(80).optional(),
  })
  .strict();

export const applyToJobPostingBodySchema = z
  .object({
    message: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const reviewApplicationBodySchema = z
  .object({
    decision: z.enum(['accepted', 'rejected']),
  })
  .strict();

export type CreateJobPostingBody = z.infer<typeof createJobPostingBodySchema>;
export type PatchJobPostingBody = z.infer<typeof patchJobPostingBodySchema>;
export type PatchResumeBody = z.infer<typeof patchResumeBodySchema>;
export type CandidateListQuery = z.infer<typeof candidateListQuerySchema>;
export type ApplyToJobPostingBody = z.infer<typeof applyToJobPostingBodySchema>;
export type ReviewApplicationBody = z.infer<typeof reviewApplicationBodySchema>;
