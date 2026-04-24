export const userProfileSchema = {
  type: 'object',
  required: [
    'id',
    'email',
    'name',
    'avatarUrl',
    'bookingReminderEnabled',
    'bookingReminderLeadMinutes',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    avatarUrl: {
      type: 'string',
      nullable: true,
      description: 'Путь `/v1/files/public/...` или абсолютный URL',
    },
    bookingReminderEnabled: { type: 'boolean' },
    bookingReminderLeadMinutes: {
      type: 'integer',
      enum: [15, 30, 60],
      description:
        'За сколько минут до визита прислать push (только при включённом флаге).',
    },
  },
};

export const patchMeRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    avatarUrl: {
      description:
        'Путь `/v1/files/public/...` или абсолютный http(s) URL; **null** — убрать аватар',
      oneOf: [
        { type: 'string', minLength: 1, maxLength: 2048 },
        { type: 'null' },
      ],
    },
    bookingReminderEnabled: { type: 'boolean' },
    bookingReminderLeadMinutes: { type: 'integer', enum: [15, 30, 60] },
  },
};

export const patchSpecialistActiveOrganizationRequestSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
  },
};

export const patchSpecialistActiveOrganizationResponseSchema = {
  type: 'object',
  required: ['activeOrganizationId', 'cancelledBookingsCount'],
  properties: {
    activeOrganizationId: { type: 'string', format: 'uuid' },
    cancelledBookingsCount: {
      type: 'integer',
      minimum: 0,
      description:
        'Сколько активных записей отменено на прежней организации (canceled_by_master).',
    },
  },
};
