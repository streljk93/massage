"use client";

import { useTranslations } from "next-intl";
import { ProfileSubpageShell } from "./profile-subpage-shell";

export function ProfileTermsPage() {
  const t = useTranslations("profileTerms");

  const sections = [
    { titleKey: "s1Title" as const, bodyKey: "s1Body" as const },
    { titleKey: "s2Title" as const, bodyKey: "s2Body" as const },
    { titleKey: "s3Title" as const, bodyKey: "s3Body" as const },
  ];

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-6">
        <p className="text-xs font-medium text-muted-foreground">
          {t("updated")}
        </p>
        {sections.map((s) => (
          <section key={s.titleKey} className="space-y-2">
            <h2 className="font-heading text-base font-semibold text-foreground">
              {t(s.titleKey)}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(s.bodyKey)}
            </p>
          </section>
        ))}
      </div>
    </ProfileSubpageShell>
  );
}
