/** OpenAPI JSON Schema (без циклических deps в Swagger plugin). */

export const canonicalAddressResponseSchema = {
  type: 'object',
  required: [
    'addressLine',
    'city',
    'latitude',
    'longitude',
    'sourceProvider',
    'sourceReference',
  ],
  properties: {
    addressLine: { type: 'string' },
    city: { type: 'string', nullable: true },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    sourceProvider: { type: 'string' },
    sourceReference: { type: 'string' },
  },
};

export const addressSuggestionItemSchema = {
  type: 'object',
  required: ['placeId', 'mainText', 'secondaryText', 'provider'],
  properties: {
    placeId: { type: 'string' },
    mainText: { type: 'string' },
    secondaryText: { type: 'string' },
    provider: {
      type: 'string',
      enum: ['locationiq', 'geoapify', 'opencage', 'nominatim'],
    },
    resolved: {
      ...canonicalAddressResponseSchema,
      description:
        'Опционально: канонический адрес сразу (как у /resolve), чтобы не дублировать запрос',
    },
  },
};

export const addressSuggestionsResponseSchema = {
  type: 'object',
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: addressSuggestionItemSchema,
    },
  },
};

export const addressResolveRequestSchema = {
  type: 'object',
  required: ['provider', 'placeId'],
  properties: {
    provider: {
      type: 'string',
      enum: ['locationiq', 'geoapify', 'opencage', 'nominatim'],
    },
    placeId: { type: 'string', minLength: 1, maxLength: 500 },
  },
};

export const addressReverseRequestSchema = {
  type: 'object',
  required: ['latitude', 'longitude'],
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
  },
};

export const addressResolveResponseSchema = {
  type: 'object',
  required: ['resolved'],
  properties: {
    resolved: canonicalAddressResponseSchema,
  },
};
