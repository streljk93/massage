/**
 * Фон модерации через Redis + BullMQ. `false` в env явно выключает — без Redis, синхронно в HTTP.
 * Требуется загрузить `bootstrap-env` до разбора `ModerationModule` / `AppModule`.
 */
export function isModerationContentQueueEnabled(): boolean {
  return process.env.MODERATION_QUEUE_ENABLED !== 'false';
}
