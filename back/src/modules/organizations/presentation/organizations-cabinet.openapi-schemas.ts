export const organizationScopedPermissionsSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'profile',
    'team',
    'joinRequests',
    'offerings',
    'hiring',
    'marketing',
    'analytics',
    'calendar',
    'bookings',
  ],
  properties: {
    profile: {
      type: 'object',
      additionalProperties: false,
      required: ['manage', 'delete'],
      properties: {
        manage: { type: 'boolean' },
        delete: { type: 'boolean' },
      },
    },
    team: {
      type: 'object',
      additionalProperties: false,
      required: ['view', 'manageRoles', 'removeMembers'],
      properties: {
        view: { type: 'boolean' },
        manageRoles: { type: 'boolean' },
        removeMembers: { type: 'boolean' },
      },
    },
    joinRequests: {
      type: 'object',
      additionalProperties: false,
      required: ['review'],
      properties: { review: { type: 'boolean' } },
    },
    offerings: {
      type: 'object',
      additionalProperties: false,
      required: ['view', 'manage'],
      properties: {
        view: { type: 'boolean' },
        manage: { type: 'boolean' },
      },
    },
    hiring: {
      type: 'object',
      additionalProperties: false,
      required: ['view', 'manage', 'reviewApplications', 'accept'],
      properties: {
        view: { type: 'boolean' },
        manage: { type: 'boolean' },
        reviewApplications: { type: 'boolean' },
        accept: { type: 'boolean' },
      },
    },
    marketing: {
      type: 'object',
      additionalProperties: false,
      required: ['view'],
      properties: {
        view: {
          type: 'boolean',
          description:
            'Раздел «Маркетинг» в навигации кабинета (плейсхолдер; только менеджеры организации).',
        },
      },
    },
    analytics: {
      type: 'object',
      additionalProperties: false,
      required: ['view'],
      properties: {
        view: {
          type: 'boolean',
          description:
            'Раздел «Аналитика» в навигации кабинета (плейсхолдер; только менеджеры организации).',
        },
      },
    },
    calendar: {
      type: 'object',
      additionalProperties: false,
      required: [
        'view',
        'viewAll',
        'manage',
        'manageAll',
        'manageWorkingHours',
      ],
      properties: {
        view: { type: 'boolean' },
        viewAll: { type: 'boolean' },
        manage: { type: 'boolean' },
        manageAll: { type: 'boolean' },
        manageWorkingHours: { type: 'boolean' },
      },
    },
    bookings: {
      type: 'object',
      additionalProperties: false,
      required: [
        'view',
        'manage',
        'manageAll',
        'manageOwn',
        'confirm',
        'cancel',
        'reschedule',
      ],
      properties: {
        view: { type: 'boolean' },
        manage: { type: 'boolean' },
        manageAll: { type: 'boolean' },
        manageOwn: { type: 'boolean' },
        confirm: { type: 'boolean' },
        cancel: { type: 'boolean' },
        reschedule: { type: 'boolean' },
      },
    },
  },
};

export const organizationCabinetTeamMemberSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'employmentId',
    'specialistId',
    'displayName',
    'role',
    'permissions',
  ],
  properties: {
    employmentId: { type: 'string', format: 'uuid' },
    specialistId: { type: 'string', format: 'uuid' },
    displayName: { type: 'string', nullable: true },
    /// Витринное фото мастера (`Specialist.imageUrl`), если задано.
    imageUrl: { type: 'string', nullable: true },
    role: {
      type: 'string',
      enum: ['owner', 'admin', 'specialist'],
      description:
        'Роль в рамках данной организации (`SpecialistOrganizationEmployment.role`).',
    },
    permissions: {
      type: 'object',
      additionalProperties: false,
      required: ['manageRole', 'remove'],
      properties: {
        manageRole: { type: 'boolean' },
        remove: { type: 'boolean' },
      },
    },
  },
};

export const organizationCabinetTeamMembersResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['permissions', 'members'],
  properties: {
    permissions: organizationScopedPermissionsSchema,
    members: {
      type: 'array',
      items: organizationCabinetTeamMemberSchema,
    },
  },
};

export const organizationTeamInviteCandidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialistId', 'displayName', 'alreadyMember'],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    displayName: { type: 'string', nullable: true },
    headline: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true },
    alreadyMember: { type: 'boolean' },
  },
};

export const organizationTeamInviteCandidatesResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialists'],
  properties: {
    specialists: {
      type: 'array',
      items: organizationTeamInviteCandidateSchema,
    },
  },
};

export const organizationTeamInviteRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialistId'],
  properties: {
    specialistId: { type: 'string', format: 'uuid' },
    targetRole: {
      type: 'string',
      enum: ['admin', 'specialist'],
      default: 'specialist',
    },
    message: { type: 'string', nullable: true, maxLength: 2000 },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const organizationTeamInvitationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'organizationId',
    'specialistId',
    'targetRole',
    'status',
    'message',
    'expiresAt',
    'createdAt',
    'updatedAt',
    'organizationName',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    specialistId: { type: 'string', format: 'uuid' },
    targetRole: { type: 'string', enum: ['admin', 'specialist'] },
    status: {
      type: 'string',
      enum: ['pending', 'accepted', 'rejected', 'canceled'],
    },
    message: { type: 'string', nullable: true },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    organizationName: { type: 'string', nullable: true },
  },
};

export const organizationTeamInvitationMutationResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['invitation'],
  properties: {
    invitation: organizationTeamInvitationSchema,
  },
};

export const organizationTeamProvisionMemberRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'name'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    name: { type: 'string', minLength: 1, maxLength: 120 },
    phone: { type: 'string', nullable: true, minLength: 8, maxLength: 32 },
    password: { type: 'string', nullable: true, minLength: 8, maxLength: 256 },
    targetRole: {
      type: 'string',
      enum: ['admin', 'specialist'],
      default: 'specialist',
    },
    imageUrl: {
      type: 'string',
      nullable: true,
      minLength: 1,
      maxLength: 2048,
    },
  },
};

export const organizationTeamProvisionMemberResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['createdUser', 'member'],
  properties: {
    createdUser: { type: 'boolean' },
    member: {
      type: 'object',
      additionalProperties: false,
      required: [
        'employmentId',
        'specialistId',
        'userId',
        'email',
        'displayName',
        'role',
      ],
      properties: {
        employmentId: { type: 'string', format: 'uuid' },
        specialistId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        displayName: { type: 'string', nullable: true },
        role: { type: 'string', enum: ['admin', 'specialist'] },
      },
    },
  },
};

export const organizationTeamInvitationListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['invitations'],
  properties: {
    invitations: {
      type: 'array',
      items: organizationTeamInvitationSchema,
    },
  },
};

export const organizationTeamInviteRespondRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['decision'],
  properties: {
    decision: { type: 'string', enum: ['accept', 'reject'] },
  },
};

export const organizationTeamRoleRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['role'],
  properties: {
    role: { type: 'string', enum: ['admin', 'specialist'] },
  },
};

export const organizationTeamMutationResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', const: true },
  },
};

export const organizationCabinetEditProfileResponseSchema = {
  type: 'object',
  required: [
    'name',
    'description',
    'phone',
    'email',
    'website',
    'yearsInBusiness',
    'addressLine',
    'city',
    'latitude',
    'longitude',
    'placeReference',
    'majorCategorySlugs',
    'galleryItems',
  ],
  properties: {
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    website: { type: 'string', nullable: true },
    yearsInBusiness: {
      type: 'integer',
      minimum: 0,
      maximum: 80,
      nullable: true,
    },
    addressLine: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    latitude: { type: 'number', nullable: true },
    longitude: { type: 'number', nullable: true },
    placeReference: {
      type: 'object',
      nullable: true,
      required: ['provider', 'placeId'],
      properties: {
        provider: {
          type: 'string',
          enum: ['locationiq', 'geoapify', 'opencage', 'nominatim'],
        },
        placeId: { type: 'string' },
      },
    },
    majorCategorySlugs: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Выбранные сферы деятельности (большие категории каталога), без отдельного «основного» мажора.',
    },
    galleryItems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['url', 'alt'],
        properties: {
          url: { type: 'string' },
          alt: { type: 'string', nullable: true },
        },
      },
    },
  },
};

export const createOrganizationRequestSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    placeReference: {
      type: 'object',
      required: ['provider', 'placeId'],
      properties: {
        provider: {
          type: 'string',
          enum: ['locationiq', 'geoapify', 'opencage', 'nominatim'],
        },
        placeId: { type: 'string', minLength: 1, maxLength: 400 },
      },
      description:
        'Ссылка на объект геокодера. Если одновременно переданы непустой `addressLine`, `latitude` и `longitude` — координаты и строка адреса берутся с клиента (точка с карты кабинета); иначе сервер заполняет адрес через resolve по place_id.',
    },
    addressLine: { type: 'string', minLength: 1, maxLength: 500 },
    city: { type: 'string', maxLength: 120, nullable: true },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    description: { type: 'string', maxLength: 4000 },
    phone: {
      type: 'string',
      maxLength: 32,
      nullable: true,
      description:
        'Вьетнам E.164: +84 и 8–12 цифр национального номера (как в профиле мастера). Пусто — не указывать.',
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      nullable: true,
    },
    website: {
      type: 'string',
      maxLength: 2048,
      nullable: true,
      description: 'URL сайта; допустимо без схемы — сервер добавит https://.',
    },
    yearsInBusiness: {
      type: 'integer',
      minimum: 0,
      maximum: 80,
      nullable: true,
    },
    imageUrl: { type: 'string', minLength: 1, maxLength: 2048, nullable: true },
    imageAlt: { type: 'string', maxLength: 500, nullable: true },
    galleryImageUrls: {
      type: 'array',
      maxItems: 24,
      items: { type: 'string', minLength: 1, maxLength: 2048 },
      description:
        'URL изображений витрины в порядке показа. Удобно передать обложку через `imageUrl` (станет первым элементом галереи), остальное — в этом массиве; либо только этот массив. Дубликаты URL отбрасываются.',
    },
    serviceCategoryIds: {
      type: 'array',
      minItems: 0,
      maxItems: 40,
      items: { type: 'string', format: 'uuid' },
      description:
        'Подкатегории в черновике ревизии (модерация). В форме кабинета не редактируются; обычно пустой массив.',
    },
    majorCategorySlugs: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      description:
        'Сферы деятельности организации (все выбранные большие категории). Пустой список — вертикали в кабинете не выбраны.',
    },
    organizationType: {
      type: 'string',
      enum: ['solo', 'business'],
      default: 'business',
      description:
        'solo — личная точка приёма; business — коммерческий салон / команда. Должен согласовываться с выбором в онбординге.',
    },
  },
  description:
    'Адрес: `placeReference` + опционально `addressLine`/`latitude`/`longitude` с карты кабинета; или только `placeReference` (resolve на сервере); или без placeReference — `addressLine`+`latitude`+`longitude`.',
};

export const workplaceJoinRequestReviewRequestSchema = {
  type: 'object',
  required: ['decision'],
  properties: {
    decision: {
      type: 'string',
      enum: ['accept', 'reject', 'block'],
      description:
        'accept — трудоустройство; reject — отклонить; block — отклонить и запретить новые заявки этого мастера в эту организацию.',
    },
  },
};

export const workplaceJoinRequestReviewResponseSchema = {
  type: 'object',
  required: ['ok', 'decision'],
  properties: {
    ok: { type: 'boolean', const: true },
    decision: {
      type: 'string',
      enum: ['accept', 'reject', 'block'],
    },
  },
};

export const workplaceJoinApplicantCabinetProfileResponseSchema = {
  type: 'object',
  required: ['specialist'],
  properties: {
    specialist: {
      type: 'object',
      description:
        'Снимок профиля мастера из cabinet-profile, доступный организации для pending-заявки.',
      additionalProperties: true,
    },
  },
};

export const workplaceJoinRequestListResponseSchema = {
  type: 'object',
  required: ['requests'],
  properties: {
    requests: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'specialistId',
          'organizationId',
          'status',
          'createdAt',
          'updatedAt',
          'resolvedAt',
          'specialist',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          specialistId: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'accepted', 'rejected', 'withdrawn', 'blocked'],
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          specialist: {
            type: 'object',
            required: ['id', 'userId', 'user'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              user: {
                type: 'object',
                required: ['id', 'name', 'email'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const workplaceOrganizationSearchResponseSchema = {
  type: 'object',
  required: ['organizations'],
  properties: {
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'addressLine', 'city'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          addressLine: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
        },
      },
    },
  },
};

export const organizationCabinetDeleteBookingsPreviewResponseSchema = {
  type: 'object',
  required: ['bookings'],
  properties: {
    bookings: {
      type: 'array',
      description:
        'Активные записи салона во всех мастерах — если продолжить удаление организации, они будут автоматически отменены.',
      items: {
        type: 'object',
        required: [
          'id',
          'status',
          'statusLabel',
          'startsAt',
          'endsAt',
          'pendingExpiresAt',
          'clientDisplayName',
          'categoryShortName',
          'durationMinutes',
          'specialistDisplayName',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'in_progress'],
          },
          statusLabel: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          pendingExpiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          clientDisplayName: { type: 'string' },
          categoryShortName: { type: 'string' },
          durationMinutes: {
            type: 'integer',
            minimum: 1,
            description:
              'Длительность слота на момент записи; отдельно от endsAt − startsAt.',
          },
          specialistDisplayName: {
            type: 'string',
            description: 'Имя/витринное имя мастера, принимающего по записи.',
          },
        },
      },
    },
  },
};

export const organizationCabinetDeleteOrganizationResponseSchema = {
  type: 'object',
  required: ['ok', 'cancelledBookingsCount'],
  properties: {
    ok: { type: 'boolean', enum: [true] },
    cancelledBookingsCount: {
      type: 'integer',
      minimum: 0,
      description: 'Число отменённых активных записей.',
    },
  },
};
