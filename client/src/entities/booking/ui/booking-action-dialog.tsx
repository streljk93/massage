"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";

/** Общая светлая «шкурка» для модалок действий с бронированием (отмена pending / confirmed). */
export const bookingActionDialogSurfaceClassName =
  "border-stone-200/90 bg-white text-neutral-900 shadow-sm dark:border-stone-200/90 dark:bg-white dark:text-neutral-900 [color-scheme:light]";

export const bookingActionDialogFooterClassName =
  "gap-2 sm:gap-2 bg-white dark:bg-white";

/** Вторичная кнопка («Не отменять» и т.п.): белая заливка в светлой модалке. */
export const bookingActionDialogDismissButtonClassName =
  "border-stone-200 bg-white hover:bg-stone-50 dark:border-stone-200 dark:bg-white dark:hover:bg-stone-100";

/** Селект и многострочное поле в этих модалках. */
export const bookingCancelFilledFieldClassName =
  "border-0 bg-stone-100 text-neutral-900 placeholder:text-neutral-500 shadow-none ring-0 dark:border-0 dark:bg-stone-100 dark:text-neutral-900 dark:placeholder:text-neutral-500";

export const bookingCancelSelectContentClassName =
  "border-0 bg-stone-100 text-neutral-900 shadow-sm ring-0 dark:border-0 dark:bg-stone-100 dark:text-neutral-900 [&_[data-slot=select-item]:focus]:bg-stone-200/45 [&_[data-slot=select-item][data-highlighted]]:bg-stone-200/45";

export type BookingActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Тело модалки (форма, текст и т.д.). */
  children?: ReactNode;
  /** Кнопки и прочий футер — полный контроль у вызывающей стороны. */
  footer: ReactNode;
  showCloseButton?: boolean;
  className?: string;
};

/**
 * Общий каркас модального окна для действий с записью: заголовок, слот контента, футер.
 * Визуально тот же тип окна, что раньше был у подтверждения отмены pending (вместо императивного alert).
 */
export function BookingActionDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  showCloseButton = true,
  className,
}: BookingActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          bookingActionDialogSurfaceClassName,
          className,
        )}
        showCloseButton={showCloseButton}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter className={bookingActionDialogFooterClassName}>
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
