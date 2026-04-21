export const advertisementItemSchema = {
  type: 'object',
  required: [
    'id',
    'ownerKind',
    'sortOrder',
    'imageUrl',
    'targetUrl',
    'title',
    'subtitle',
    'ctaLabel',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    ownerKind: { type: 'string', enum: ['internal', 'external'] },
    sortOrder: { type: 'integer', example: 0 },
    imageUrl: { type: 'string', format: 'uri' },
    targetUrl: { type: 'string', nullable: true, format: 'uri' },
    title: { type: 'string', example: 'Скидка 25%' },
    subtitle: { type: 'string', example: 'Новым клиентам' },
    ctaLabel: { type: 'string', example: 'Регистрация' },
  },
};

export const advertisementsListResponseSchema = {
  type: 'object',
  required: ['placement', 'items'],
  properties: {
    placement: { type: 'string', example: 'home_promo' },
    items: {
      type: 'array',
      items: advertisementItemSchema,
    },
  },
};
