import {
  organizationListItemSchema,
  specialistListItemSchema,
} from '../../directory/presentation/directory.openapi-schemas';

export const favoriteItemSchema = {
  type: 'object',
  required: ['targetKind', 'targetId', 'createdAt'],
  properties: {
    targetKind: {
      type: 'string',
      enum: ['organization', 'specialist'],
    },
    targetId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const favoritesListResponseSchema = {
  type: 'object',
  required: ['favorites'],
  properties: {
    favorites: {
      type: 'array',
      items: favoriteItemSchema,
    },
  },
};

export const addFavoriteRequestSchema = {
  type: 'object',
  required: ['targetKind', 'targetId'],
  properties: {
    targetKind: {
      type: 'string',
      enum: ['organization', 'specialist'],
    },
    targetId: { type: 'string', format: 'uuid' },
  },
};

export const mergeFavoritesRequestSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 500,
      items: {
        type: 'object',
        required: ['targetKind', 'targetId'],
        properties: {
          targetKind: {
            type: 'string',
            enum: ['organization', 'specialist'],
          },
          targetId: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
};

export const favoritesOrganizationsListingResponseSchema = {
  type: 'object',
  required: ['organizations'],
  properties: {
    organizations: {
      type: 'array',
      items: organizationListItemSchema,
    },
  },
};

export const favoritesSpecialistsListingResponseSchema = {
  type: 'object',
  required: ['specialists'],
  properties: {
    specialists: {
      type: 'array',
      items: specialistListItemSchema,
    },
  },
};
