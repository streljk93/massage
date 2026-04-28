export const userProfileSchema = {
  type: 'object',
  required: [
    'id',
    'email',
    'name',
    'avatarUrl',
    'locale',
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
    locale: {
      type: 'string',
      nullable: true,
      enum: ['en', 'vi', 'ru'],
      description:
        'Локаль интерфейса из клиента; для писем о бронированиях и т.п.',
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
    locale: {
      type: 'string',
      enum: ['en', 'vi', 'ru'],
      description: 'Как в префиксе пути клиента `/[locale]/...`',
    },
    bookingReminderEnabled: { type: 'boolean' },
    bookingReminderLeadMinutes: { type: 'integer', enum: [15, 30, 60] },
  },
};
