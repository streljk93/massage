import { getToastState, LOADING_LIKE_MS } from "./toast-store";
import { notify } from "./notify";

export type WithLoadingMessages = {
  loading: string;
  success: string;
  error: string;
};

/**
 * Показать toast «в процессе», затем success или error.
 * Сообщение success/error также уходит через `notify` (отдельные toasts), чтобы
 * варианты (success / destructive) отображались с верными стилями.
 */
export async function withLoadingToast<T>(
  asyncFn: () => Promise<T>,
  messages: WithLoadingMessages,
): Promise<T> {
  const loadingId = getToastState().push({
    kind: "default",
    title: messages.loading,
    duration: LOADING_LIKE_MS,
  });
  try {
    const result = await asyncFn();
    getToastState().dismiss(loadingId);
    notify.success(messages.success);
    return result;
  } catch (error) {
    getToastState().dismiss(loadingId);
    notify.error(messages.error);
    throw error;
  }
}
