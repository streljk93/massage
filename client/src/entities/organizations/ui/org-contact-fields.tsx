"use client";

import { Input } from "@/shared/ui";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/shadcn/input-group";
import {
  normalizeEmailOnBlur,
  normalizeWebsiteOnBlur,
} from "../lib/organization-contact-form";

export type OrgContactFieldsProps = {
  phoneLocal: string;
  setPhoneLocal: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  disabled?: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

/**
 * Телефон / email / сайт салона: как в шаге профиля онбординга (+84 и национальные цифры),
 * сайт — подстановка https:// при вводе без схемы (на blur).
 */
export function OrgContactFields({
  phoneLocal,
  setPhoneLocal,
  email,
  setEmail,
  website,
  setWebsite,
  disabled,
  t,
}: OrgContactFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("orgFormPhone")}</span>
        <p className="text-pretty text-xs text-muted-foreground">{t("fieldPhoneVnOnly")}</p>
        <InputGroup
          className="h-12 min-h-12 w-full items-stretch rounded-full border-0 bg-muted/50 pl-0.5 has-disabled:opacity-60"
          aria-label={t("fieldPhoneGroupAria")}
        >
          <InputGroupAddon
            align="inline-start"
            className="shrink-0 border-r border-border/50 pr-2 pl-3"
          >
            <InputGroupText className="text-foreground tabular-nums">+84</InputGroupText>
            <span className="text-xs text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-xs font-medium text-muted-foreground">VN</span>
          </InputGroupAddon>
          <InputGroupInput
            className="h-12 min-w-0 text-base"
            value={phoneLocal}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 12);
              setPhoneLocal(next);
            }}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={t("phoneLocalPlaceholder")}
          />
        </InputGroup>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("orgFormEmail")}</span>
        <Input
          className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
          value={email}
          disabled={disabled}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={(e) => setEmail(normalizeEmailOnBlur(e.target.value))}
          type="email"
          inputMode="email"
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("orgFormWebsite")}</span>
        <p className="text-pretty text-xs text-muted-foreground">{t("orgFormWebsiteHint")}</p>
        <Input
          className="h-12 min-h-12 rounded-2xl border-0 bg-muted/50"
          value={website}
          disabled={disabled}
          onChange={(e) => setWebsite(e.target.value)}
          onBlur={(e) => setWebsite(normalizeWebsiteOnBlur(e.target.value))}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
        />
      </div>
    </>
  );
}
