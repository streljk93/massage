"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * `menu` — авторизован, онбординг загружен: бургер + дровер (назад только внутри меню).
 * `menuPending` — ждём сессию/онбординг: скелет бургера, без «назад во флаше».
 * `back` — гость: отдельная кнопка «в приложение».
 */
export type CabinetHeaderLeadRole = "back" | "menu" | "menuPending";

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
