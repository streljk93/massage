"use client";

import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/app/i18n/navigation";
import {
  BusinessActiveOrganizationContextCard,
  pickActiveWorkplaceOrganization,
  useSpecialistMyOrganizationsQuery,
} from "@/entities/organizations";
import { cn } from "@/shared/lib";

function isBusinessSetupPath(pathname: string): boolean {
  return pathname === "/business/setup" || pathname.startsWith("/business/setup/");
}

type BusinessCabinetActiveOrgDockProps = {
  onVisibleChange?: (visible: boolean) => void;
};

/**
 * Фиксированная нижняя панель ЛК бизнеса: активная организация (место приёма),
 * как у клиентского приложения с `HomeBottomNav`.
 */
export function BusinessCabinetActiveOrgDock({ onVisibleChange }: BusinessCabinetActiveOrgDockProps) {
  const pathname = usePathname();
  const t = useTranslations("businessAppNav");
  const { status } = useSession();
  const authed = status === "authenticated";

  const inSetupWizard = isBusinessSetupPath(pathname);
  const orgsQuery = useSpecialistMyOrganizationsQuery({
    enabled: authed && !inSetupWizard,
  });

  const activeOrg = useMemo(
    () => pickActiveWorkplaceOrganization(orgsQuery.data),
    [orgsQuery.data],
  );

  const visible = !inSetupWizard && authed && activeOrg != null;

  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  if (!visible || activeOrg == null) {
    return null;
  }

  return (
    <nav
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label={t("activeWorkplaceBarLabel")}
    >
      {/* Те же вертикальные отступы, что у ряда табов в `HomeBottomNav`: `px-2 pt-2 pb-1` */}
      <div className="mx-auto flex w-full max-w-lg items-center px-2 pt-2 pb-1">
        <BusinessActiveOrganizationContextCard
          organization={activeOrg}
          className="min-w-0 flex-1"
        />
      </div>
    </nav>
  );
}
