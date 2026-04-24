import { z } from 'zod';

/**
 * [Dev] Произвольный FCM тест-уведомление пользователю по email
 * (должны быть строки в `UserFcmToken` для этого `userId`).
 */
export const devTestFcmBodySchema = z.object({
  email: z.string().email().max(320),
  title: z.string().min(1).max(200),
  /** Текст в теле push (и в `notification.body` для FCM). */
  text: z.string().min(1).max(2000),
  /**
   * Подождать N секунд до отправки FCM (сам HTTP-запрос «висит» ≈N с).
   * Удобно переключить вкладку и проверить фоновую доставку.
   */
  delaySeconds: z.coerce.number().int().min(0).max(120).optional(),
});

export type DevTestFcmBody = z.infer<typeof devTestFcmBodySchema>;
