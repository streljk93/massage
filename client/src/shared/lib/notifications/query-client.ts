import {
  MutationCache,
  QueryClient,
  type DefaultOptions,
} from "@tanstack/react-query";

import { notify } from "./notify";

const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  },
  mutations: {},
};

/**
 * Готовый `QueryClient` с глобальным обработчиком ошибок мутаций (toast).
 * Для собственного текста ошибки на уровне мутации: `meta: { skipGlobalErrorNotification: true }` и свой `onError`.
 */
export function createAppQueryClient(
  options?: { defaultOptions?: DefaultOptions },
): QueryClient {
  const mergedDefaults: DefaultOptions = {
    ...defaultQueryOptions,
    ...options?.defaultOptions,
    queries: {
      ...defaultQueryOptions.queries,
      ...options?.defaultOptions?.queries,
    },
    mutations: {
      ...defaultQueryOptions.mutations,
      ...options?.defaultOptions?.mutations,
    },
  };

  return new QueryClient({
    defaultOptions: mergedDefaults,
    mutationCache: new MutationCache({
      onError: (_error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.skipGlobalErrorNotification) {
          return;
        }
        notify.error("Ошибка запроса");
      },
    }),
  });
}
