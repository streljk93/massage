export const fileUploadResponseSchema = {
  type: 'object',
  required: ['visibility', 'key', 'filename', 'url', 'contentType', 'size'],
  properties: {
    visibility: { type: 'string', enum: ['public', 'private'] },
    key: {
      type: 'string',
      example: 'public/uploads-550e8400-e29b-41d4-a716-446655440000.jpg',
      description: 'Полный ключ объекта в бакете (префикс + имя файла)',
    },
    filename: {
      type: 'string',
      example: 'uploads-550e8400-e29b-41d4-a716-446655440000.jpg',
    },
    url: {
      type: 'string',
      example:
        '/v1/files/public/uploads-550e8400-e29b-41d4-a716-446655440000.jpg',
      description:
        'GET: публичный — без токена; private — только с Bearer access',
    },
    contentType: { type: 'string', example: 'image/jpeg' },
    size: { type: 'integer', example: 1024 },
  },
};
