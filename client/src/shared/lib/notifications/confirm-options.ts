export type ConfirmActionOptions = {
  title: string;
  description?: string;
  /**
   * Текст основной (подтверждающей) кнопки.
   * @default "Продолжить" — локализуйте на уровне вызова при необходимости.
   */
  confirmLabel?: string;
  /**
   * @default "Отмена"
   */
  cancelLabel?: string;
  /**
   * Опасное действие (например удаление) — `destructive` в стиле кнопки.
   */
  destructive?: boolean;
};
