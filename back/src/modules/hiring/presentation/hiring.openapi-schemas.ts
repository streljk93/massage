const roleSchema = { type: 'string', enum: ['admin', 'specialist'] };
const matchReasonSchema = {
  type: 'string',
  enum: [
    'category_match',
    'experience_match',
    'high_rating',
    'recent_activity',
  ],
};

export const candidateListItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'specialistId',
    'displayName',
    'headline',
    'experienceYears',
    'skillsCategoryIds',
    'matchScore',
    'matchReasons',
    'matchedCategoryIds',
  ],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    displayName: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true },
    headline: { type: 'string', nullable: true },
    summary: { type: 'string', nullable: true },
    experienceYears: { type: 'integer', nullable: true },
    skillsCategoryIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    matchScore: { type: 'number', minimum: 0, maximum: 1 },
    matchReasons: { type: 'array', items: matchReasonSchema },
    matchedCategoryIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
  },
};

export const candidateListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates', 'nextCursor'],
  properties: {
    candidates: { type: 'array', items: candidateListItemSchema },
    nextCursor: { type: 'string', nullable: true },
  },
};

export const jobPostingSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'organizationId',
    'title',
    'status',
    'role',
    'applicationsCount',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    requirements: { type: 'string', nullable: true },
    organizationOfferingId: { type: 'string', format: 'uuid', nullable: true },
    serviceCategoryId: { type: 'string', format: 'uuid', nullable: true },
    serviceCategoryName: { type: 'string', nullable: true },
    experienceMinYears: { type: 'integer', nullable: true },
    role: roleSchema,
    status: { type: 'string', enum: ['draft', 'open', 'closed'] },
    applicationsCount: { type: 'integer' },
  },
};

export const jobPostingsListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['jobPostings'],
  properties: { jobPostings: { type: 'array', items: jobPostingSchema } },
};

export const jobPostingMutationRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 2, maxLength: 140 },
    description: { type: 'string', nullable: true, maxLength: 4000 },
    requirements: { type: 'string', nullable: true, maxLength: 4000 },
    organizationOfferingId: { type: 'string', format: 'uuid', nullable: true },
    serviceCategoryId: { type: 'string', format: 'uuid', nullable: true },
    experienceMinYears: {
      type: 'integer',
      minimum: 0,
      maximum: 80,
      nullable: true,
    },
    role: roleSchema,
    status: { type: 'string', enum: ['draft', 'open', 'closed'] },
  },
};

export const resumeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['visibility'],
  properties: {
    headline: { type: 'string', nullable: true },
    summary: { type: 'string', nullable: true },
    experienceYears: { type: 'integer', nullable: true },
    visibility: { type: 'string', enum: ['public', 'private'] },
  },
};

export const patchResumeRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', nullable: true, maxLength: 140 },
    summary: { type: 'string', nullable: true, maxLength: 4000 },
    experienceYears: {
      type: 'integer',
      minimum: 0,
      maximum: 80,
      nullable: true,
    },
    visibility: { type: 'string', enum: ['public', 'private'] },
  },
};

export const hiringContactSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type',
    'id',
    'organizationId',
    'specialistId',
    'source',
    'status',
    'isActive',
    'application',
  ],
  properties: {
    type: { type: 'string', enum: ['manual', 'application'] },
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    specialistId: { type: 'string', format: 'uuid' },
    jobPostingId: { type: 'string', format: 'uuid', nullable: true },
    source: { type: 'string', enum: ['application'] },
    status: {
      type: 'string',
      enum: ['pending', 'accepted', 'rejected', 'closed'],
    },
    isActive: { type: 'boolean' },
    displayLabelKey: {
      type: 'string',
      enum: ['youApplied'],
    },
    application: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: [
        'id',
        'status',
        'message',
        'jobPostingSnapshot',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: {
          type: 'string',
          enum: ['pending', 'accepted', 'rejected'],
        },
        message: { type: 'string', nullable: true },
        jobPostingSnapshot: {
          type: 'object',
          additionalProperties: true,
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};

export const applyRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string', nullable: true, maxLength: 2000 },
  },
};

export const respondRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['decision'],
  properties: { decision: { type: 'string', enum: ['accepted', 'rejected'] } },
};

export const contactsListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contacts'],
  properties: { contacts: { type: 'array', items: hiringContactSchema } },
};

export const contactMutationResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contact'],
  properties: { contact: hiringContactSchema },
};
