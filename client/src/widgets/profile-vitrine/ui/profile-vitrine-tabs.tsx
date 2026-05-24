"use client";

import { useTranslations } from "next-intl";
import { cn, motion } from "@/shared/lib";
import type { ProfileVitrineTabId } from "../model/profile-vitrine-tab";
import { PROFILE_VITRINE_TABS } from "../model/profile-vitrine-tab";

export type ProfileVitrineTabsProps = {
  activeTab: ProfileVitrineTabId;
  onTabChange: (tab: ProfileVitrineTabId) => void;
  className?: string;
  /** Подпись вкладки «О …» для салона vs мастера. */
  subjectKind?: "specialist" | "organization";
};

export function ProfileVitrineTabs({
  activeTab,
  onTabChange,
  className,
  subjectKind = "specialist",
}: ProfileVitrineTabsProps) {
  const t = useTranslations("profileVitrine.tabs");

  const tabLabel = (tabId: ProfileVitrineTabId) => {
    if (tabId === "about" && subjectKind === "organization") {
      return t("aboutOrganization");
    }
    return t(tabId);
  };

  return (
    <div
      className={cn(
        "flex gap-8 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
    >
      {PROFILE_VITRINE_TABS.map((tabId) => {
        const active = tabId === activeTab;
        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tabId)}
            className={cn(
              motion.interactivePressStrong,
              "shrink-0 border-b-2 pb-3.5 pt-3.5 text-sm transition-colors",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {tabLabel(tabId)}
          </button>
        );
      })}
    </div>
  );
}
