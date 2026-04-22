import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Не показывать глобальный toast при ошибке мутации
       * (если обрабатываете ошибку в `onError` или показываете свой `notify`).
       */
      skipGlobalErrorNotification?: boolean;
    };
  }
}
