/**
 * Варианты уведомлений, отображаемых через shadcn Toast.
 * `destructive` — семантически близко к `variant: "destructive"` (ошибки).
 */
export type NotificationKind = "default" | "destructive" | "success" | "warning" | "info";

export type NotifyOptions = {
  /**
   * Длительность тоста (мс). Обычно 2000; для FCM in-app, например, 4000.
   * Очень большие значения — «лоадер» (см. `LOADING_LIKE_MS` в toast-store).
   */
  duration?: number;
};
