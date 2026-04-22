import { useConfirmActionStore } from "./confirm-store";
import type { ConfirmActionOptions } from "./confirm-options";

export type { ConfirmActionOptions } from "./confirm-options";

/**
 * Модальное подтверждение (AlertDialog). Возвращает `true`, если пользователь подтвердил.
 */
export function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return useConfirmActionStore.getState().openConfirm(options);
}
