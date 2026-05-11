"use client";

import { createContext, useContext, useEffect, useCallback, useState, type ReactNode } from "react";

/**
 * `menu` — авторизован, онбординг загружен: бургер + дровер (назад только внутри меню).
 * `menuPending` — ждём сессию/онбординг: скелет бургера, без «назад во флаше».
 * `back` — гость: отдельная кнопка «в приложение».
 * `none` — без ведущего слота кабинета: заголовок слева без колонки под бургер (визард на `/business/setup/*`).
 */
export type CabinetHeaderLeadRole = "back" | "menu" | "menuPending" | "none";

const CabinetHeaderLeadContext = createContext<CabinetHeaderLeadRole>("menuPending");

export function BusinessCabinetHeaderProvider({
  lead,
  children,
}: {
  lead: CabinetHeaderLeadRole;
  children: ReactNode;
}) {
  return (
    <CabinetHeaderLeadContext.Provider value={lead}>
      {children}
    </CabinetHeaderLeadContext.Provider>
  );
}

export function useCabinetHeaderLeadRole(): CabinetHeaderLeadRole {
  return useContext(CabinetHeaderLeadContext);
}

// Контекст заголовка страницы: страницы вызывают useSetBusinessPageTitle,
// layout читает title напрямую из своего useState.
const BusinessScreenTitleSetContext = createContext<(title: string) => void>(
  () => {},
);

export { BusinessScreenTitleSetContext };

/**
 * Вызов в компоненте страницы, чтобы передать заголовок в шапку кабинета.
 * Устанавливает title при монтировании и очищает при размонтировании.
 */
export function useSetBusinessPageTitle(title: string): void {
  const setTitle = useContext(BusinessScreenTitleSetContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);
}

// ─── Сайдбар: toggle на десктопе ────────────────────────────────────────────

type BusinessSidebarContextValue = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
};

const BusinessSidebarContext = createContext<BusinessSidebarContextValue>({
  sidebarOpen: true,
  toggleSidebar: () => {},
});

export { BusinessSidebarContext };

export function useBusinessSidebarOpen(): boolean {
  return useContext(BusinessSidebarContext).sidebarOpen;
}

export function useToggleBusinessSidebar(): () => void {
  return useContext(BusinessSidebarContext).toggleSidebar;
}

/** Провайдер: управляет видимостью сайдбара на десктопе. */
export function BusinessSidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(
    () => setSidebarOpen((v) => !v),
    [],
  );
  return (
    <BusinessSidebarContext.Provider value={{ sidebarOpen, toggleSidebar }}>
      {children}
    </BusinessSidebarContext.Provider>
  );
}

