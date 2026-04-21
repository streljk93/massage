"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";
import { useComingSoonStore } from "../model/coming-soon-store";

/** Глобальный диалог «Скоро» — держится в дереве провайдеров, открывается через стор. */
export function ComingSoonDialogHost() {
  const isOpen = useComingSoonStore((s) => s.isOpen);
  const close = useComingSoonStore((s) => s.close);
  const t = useTranslations("comingSoon");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          variant="primary"
          className="mt-1 w-full rounded-xl"
          onClick={() => close()}
        >
          {t("confirm")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
