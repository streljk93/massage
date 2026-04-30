/** JSON Schema для Swagger — [Dev] POST …/dev/moderation/image-eval */

const moderationClipPayloadRef = {
  type: 'object',
  nullable: true,
  description:
    'Блок CLIP контейнера `image-moderation` (violence/blood/gore/… когда включено)',
  properties: {
    enabled: { type: 'boolean' },
    review_recommended: { type: 'boolean', nullable: true },
    threshold: { type: 'number', nullable: true },
    scores: {
      type: 'object',
      nullable: true,
      additionalProperties: { type: 'number' },
    },
  },
  additionalProperties: true,
};

export const devModerationImageEvalMultipartRequestSchema = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description:
        'Изображение (jpeg, png, webp или gif до 10 МБ). То же multipart-поле, что для `POST /files/public`.',
    },
  },
};

export const devModerationImageEvalResponseSchema = {
  type: 'object',
  required: ['stored_path', 'infraUnavailable'],
  properties: {
    stored_path: {
      type: 'string',
      description: 'Относительный путь после загрузки (`/v1/files/public/…`)',
    },
    resolved_image_url: {
      type: 'string',
      nullable: true,
      description:
        'Абсолютный URL, переданный в sidecar (`MODERATION_FILE_FETCH_ORIGIN` + путь). `null` если origin не задан.',
    },
    infraUnavailable: {
      type: 'boolean',
      description:
        'true — `IMAGE_MODERATION_BASE_URL` пустой; скоринг не вызывался.',
    },
    moderation_file_fetch_misconfigured: {
      type: 'boolean',
      description:
        'true — не задан `MODERATION_FILE_FETCH_ORIGIN` (нельзя построить URL для скачивания изображения контейнером).',
    },
    score: {
      type: 'object',
      nullable: true,
      description: 'JSON от POST …/v1/score (NudeNet + CLIP) при успехе',
      properties: {
        safe: { type: 'boolean', nullable: true },
        unsafe_score: { type: 'number', nullable: true },
        safe_score: { type: 'number', nullable: true },
        clip: moderationClipPayloadRef,
      },
      additionalProperties: true,
    },
    error: {
      type: 'string',
      nullable: true,
      description: 'Текст ошибки HTTP/сети/парсинга от sidecar',
    },
    http_status: {
      type: 'integer',
      nullable: true,
      description: 'HTTP-код ответа sidecar при ошибке',
    },
  },
};
