/** BullMQ queue name для фон модерации UGC (`@Processor`, `registerQueue`). */
export const CONTENT_MODERATION_QUEUE = 'content-moderation';

/** Job — новый профиль организации после онбординга (`data.organizationId`). */
export const CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE =
  'organization_profile';

/** Job — черновик витринного профиля мастера (`data.specialistProfileRevisionId`). */
export const CONTENT_MODERATION_JOB_SPECIALIST_PROFILE =
  'specialist_profile';
