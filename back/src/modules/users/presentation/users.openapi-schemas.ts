export const userProfileSchema = {
  type: 'object',
  required: ['id', 'email', 'name', 'avatarUrl'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    avatarUrl: {
      type: 'string',
      nullable: true,
      description: 'Путь `/v1/files/public/...` или абсолютный URL',
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
  },
};
