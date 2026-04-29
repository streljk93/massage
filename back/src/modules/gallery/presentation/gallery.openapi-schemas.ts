export const reorderGalleryItemsRequestSchema = {
  type: 'object',
  required: ['orderedItemIds'],
  properties: {
    orderedItemIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', format: 'uuid' },
      description:
        'Все id элементов этой галереи в желаемом порядке отображения (меньший индекс — раньше в карусели).',
    },
  },
};

export const reorderGalleryItemsResponseSchema = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', const: true },
  },
};

export const organizationVitrineGalleryResponseSchema = {
  type: 'object',
  required: ['galleryId', 'items'],
  properties: {
    galleryId: { type: 'string', format: 'uuid', nullable: true },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'url', 'kind', 'sortOrder'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string' },
          alt: { type: 'string', nullable: true },
          kind: { type: 'string', enum: ['image', 'video'] },
          sortOrder: { type: 'integer' },
        },
      },
    },
  },
};
