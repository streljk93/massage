"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog";

/** Высота модалки: dvh + safe-area, без обрезания под вырез / home indicator. */
const profileBookingDialogMaxHeightClassName =
  "max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-0.5rem))] max-lg:max-h-[min(94dvh,calc(100dvh-env(safe-area-inset-bottom,0px)-0.25rem))]";

export type ProfileBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** Основная CTA («Записаться») — всегда видна, не уезжает в скролл. */
  footer: ReactNode;
};

/**
 * Запись с витрины: mobile — нижний sheet; desktop — центрированный диалог.
 * Контент шагов — в прокручиваемой области между шапкой и футером.
 */
export function ProfileBookingDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: ProfileBookingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[60]"
        className={cn(
          "z-[60] grid w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg",
          profileBookingDialogMaxHeightClassName,
          "max-lg:top-auto max-lg:right-0 max-lg:bottom-0 max-lg:left-0 max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0 max-lg:rounded-b-none max-lg:rounded-t-2xl max-lg:border-b-0",
          "lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl",
        )}
      >
        <div className="shrink-0 border-b border-border/50">
          <div
            className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted/80 lg:hidden"
            aria-hidden
          />
          <DialogHeader className="gap-1 px-4 py-3 pr-12 max-lg:pt-2">
            <DialogTitle className="text-left text-base font-semibold">
              {title}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div
          className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]"
          data-slot="profile-booking-dialog-body"
        >
          {children}
        </div>

        <div
          className="shrink-0 border-t border-border/50 bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
          data-slot="profile-booking-dialog-footer"
        >
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
