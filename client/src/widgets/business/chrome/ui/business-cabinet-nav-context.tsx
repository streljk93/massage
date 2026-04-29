"use client";

import { createContext, useContext, type ReactNode } from "react";

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
