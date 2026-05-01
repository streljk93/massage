"use client";

import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/app/i18n/navigation";
import { cn, motion } from "@/shared/lib";
import {
  cabinetOrganizationCoverSrc,
  displayNameForCabinetOrganization,
  type SpecialistMyOrganizationRow,
} from "../lib/specialist-my-organizations";

export type BusinessActiveOrganizationContextCardProps = {
  organization: SpecialistMyOrganizationRow;
  className?: string;
};

/**
 * Компактный контекст активной организации мастера (место приёма) —
 * нижний фиксированный navbar в ЛК бизнеса.
 */
export function BusinessActiveOrganizationContextCard({
  organization,
  className,
}: BusinessActiveOrganizationContextCardProps) {
  const t = useTranslations("businessActiveOrganizationContextCard");
  const displayName = displayNameForCabinetOrganization(organization);
  const coverSrc = cabinetOrganizationCoverSrc(organization);

  return (
    <Link
      href="/business/organizations"
      title={t("linkAria", { name: displayName })}
      aria-label={t("linkAria", { name: displayName })}
      className={cn(
        motion.interactivePressStrong,
        "flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-lg px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      <div
        className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted/40"
        aria-hidden
      >
        {coverSrc != null ?
          <img
            src={coverSrc}
            alt=""
            className="size-full object-cover"
          />
        : <div className="flex size-full items-center justify-center text-muted-foreground">
            <Building2 className="size-5" strokeWidth={2} aria-hidden />
          </div>
        }
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[0.65rem] leading-none font-medium text-muted-foreground">
          {t("label")}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold leading-tight tracking-tight text-foreground">
          {displayName}
        </p>
      </div>
    </Link>
  );
}
