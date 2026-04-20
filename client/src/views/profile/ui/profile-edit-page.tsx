"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ProfileSubpageShell } from "./profile-subpage-shell";
import { profileUserDemo } from "../lib/mock-data";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib";

const labelClass = "text-xs font-medium text-muted-foreground";

export function ProfileEditPage() {
  const t = useTranslations("profileEdit");
  const [firstName, setFirstName] = useState<string>(profileUserDemo.firstName);
  const [email, setEmail] = useState<string>(profileUserDemo.email);

  return (
    <ProfileSubpageShell title={t("title")}>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className={cn(labelClass)}>{t("firstNameLabel")}</p>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <p className={cn(labelClass)}>{t("emailLabel")}</p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <Button type="button" variant="primary" className="w-full rounded-xl">
          {t("save")}
        </Button>
      </div>
    </ProfileSubpageShell>
  );
}
