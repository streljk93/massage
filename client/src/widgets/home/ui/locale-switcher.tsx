"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/shadcn/popover";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { Button } from "@/shared/ui/button";
import { cn, motion } from "@/shared/lib";

export type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const t = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            motion.interactivePress,
            "-m-1.5 h-8 gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label={t("switchAria")}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Globe className="size-3.5 shrink-0" aria-hidden />
          <span className="uppercase tabular-nums">{locale}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto min-w-[9.5rem] p-1"
        sideOffset={6}
      >
        <ul
          className="flex flex-col gap-0.5"
          role="listbox"
          aria-label={t("switchAria")}
        >
          {routing.locales.map((loc) => (
            <li key={loc} role="none">
              <button
                type="button"
                role="option"
                aria-selected={locale === loc}
                className={cn(
                  motion.interactivePress,
                  "flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm",
                  locale === loc
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                onClick={() => {
                  setOpen(false);
                  router.replace(pathname, { locale: loc });
                }}
              >
                {t(`name.${loc}`)}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
