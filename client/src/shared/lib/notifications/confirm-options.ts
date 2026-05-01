import type { ReactNode } from "react";

export type ConfirmActionOptions = {
  title: string;
  description?: string;
  /**
   * Дополнительное содержимое тела модалки (списки, разметка) под текстом описания.
   */
  body?: ReactNode;
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
